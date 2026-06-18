import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { readRedeemRequestBody } from '@/lib/redeem-request';

const REDEEM_IP_RATE_LIMIT_MAX = 20;
const REDEEM_CODE_RATE_LIMIT_MAX = 10;
const REDEEM_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Try again later.',
      code: 'RATE_LIMITED',
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
      },
    },
  );
}

function cardSecretRateLimitKey(code: string): string {
  const codeHash = createHash('sha256').update(code).digest('hex');
  return `card-secret-redeem:code:${codeHash}`;
}

export async function POST(req: Request) {
  try {
    const bodyResult = await readRedeemRequestBody(req);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { success: false, error: bodyResult.error },
        { status: 400 },
      );
    }

    const { code, targetService, countryId } = bodyResult.body;

    const ipRateLimit = checkRateLimit({
      key: `card-secret-redeem:ip:${getClientIp(req.headers)}`,
      max: REDEEM_IP_RATE_LIMIT_MAX,
      windowMs: REDEEM_RATE_LIMIT_WINDOW_MS,
    });
    if (ipRateLimit.limited) {
      return rateLimitedResponse(ipRateLimit.retryAfterSeconds);
    }

    const codeRateLimit = checkRateLimit({
      key: cardSecretRateLimitKey(code),
      max: REDEEM_CODE_RATE_LIMIT_MAX,
      windowMs: REDEEM_RATE_LIMIT_WINDOW_MS,
    });
    if (codeRateLimit.limited) {
      return rateLimitedResponse(codeRateLimit.retryAfterSeconds);
    }

    // 1. Fetch Configs
    const configRecords = await db.systemConfig.findMany();
    const config: Record<string, string> = {};
    for (const conf of configRecords) {
      config[conf.key] = conf.value;
    }

    const apiKey = config['HERO_API_KEY'];
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'System not configured properly (API Key missing)' }, { status: 500 });
    }
    const exchangeRate = parseFloat(config['EXCHANGE_RATE'] || '1');
    const servicesStr = config['SERVICES'] || '[]';
    let servicesConfig: any[] = [];
    try {
      servicesConfig = JSON.parse(servicesStr);
    } catch (e) {
      servicesConfig = [];
    }

    const serviceDef = servicesConfig.find((s: any) => s.id === targetService);
    if (!serviceDef) {
      return NextResponse.json({ success: false, error: 'Invalid service selected' }, { status: 400 });
    }

    // 2. Check real price from Supplier (Outside transaction)
    const client = new HeroSMSClient(apiKey);
    const apiPrices = await client.getPrices(targetService, countryId);

    let apiCost = 0;
    if (apiPrices[countryId] && apiPrices[countryId][targetService]) {
      apiCost = Number(apiPrices[countryId][targetService].cost || 0);
    }

    if (apiCost <= 0) {
      return NextResponse.json({ success: false, error: '该服务当前无库存或暂不支持 (Service unavailable or out of stock)' }, { status: 400 });
    }

    const finalCost = Math.ceil(apiCost * exchangeRate);

    // 3. Reserve Funds (Short Transaction)
    let secret;
    try {
      secret = await db.$transaction(async (tx) => {
        const s = await tx.cardSecret.findUnique({
          where: { code },
        });

        if (!s) {
          throw new Error('无效的卡密 (Invalid card secret)');
        }

        if (s.value < finalCost) {
          throw new Error(`余额不足。需要 ¥${finalCost}，您的余额为 ¥${s.value} (Insufficient balance)`);
        }

        // Atomically deduct balance
        const updatedSecret = await tx.cardSecret.update({
          where: { id: s.id },
          data: { value: { decrement: finalCost } },
        });

        if (updatedSecret.value < 0) {
          throw new Error(`并发扣费或余额不足。需要 ¥${finalCost} (Insufficient balance)`);
        }

        // Update status based on precise post-decrement value
        return await tx.cardSecret.update({
          where: { id: s.id },
          data: { status: updatedSecret.value > 0 ? 'UNUSED' : 'USED' }
        });
      });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }

    // 4. Request Number from Supplier (Outside transaction)
    let numberData;
    try {
      numberData = await client.getNumber(targetService, countryId);

      if (!numberData || !numberData.id || !numberData.phone) {
        throw new Error('上游返回无效数据 (Supplier returned invalid number data)');
      }
    } catch (err: any) {
      // Refund the reserved funds if upstream fails
      await db.cardSecret.update({
        where: { id: secret.id },
        data: {
          value: { increment: finalCost },
          status: 'UNUSED'
        }
      });
      return NextResponse.json({ success: false, error: `向上游获取号码失败 (Failed to get number): ${err.message}` }, { status: 500 });
    }

    // 5. Create local DB records
    let result;
    try {
      result = await db.$transaction(async (tx) => {
        const localNumber = await tx.number.create({
          data: {
            phone: numberData.phone,
            country: countryId,
            service: targetService,
            status: 'LOCKED'
          }
        });

        return await tx.order.create({
          data: {
            cardSecretId: secret.id,
            numberId: localNumber.id,
            supplierId: numberData.id,
            status: 'PENDING',
            cost: finalCost,
          },
          include: {
            Number: true,
          }
        });
      });
    } catch (dbErr: any) {
      // If DB fails, cancel upstream to refund upstream balance, and refund local balance
      try {
        await client.setStatus(numberData.id, 8); // 8 is cancel
      } catch (cancelErr) {
        console.error('Failed to cancel upstream number after DB error', cancelErr);
      }

      await db.cardSecret.update({
        where: { id: secret.id },
        data: {
          value: { increment: finalCost },
          status: 'UNUSED'
        }
      });

      return NextResponse.json({ success: false, error: '创建订单失败 (Failed to create order)' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    console.error('Redeem error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
