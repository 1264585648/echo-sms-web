import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';

export async function POST(req: Request) {
  try {
    const { code, targetService, countryId } = await req.json();

    if (!code || !targetService || !countryId) {
      return NextResponse.json({ error: 'Card secret code, target service, and countryId are required' }, { status: 400 });
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

    // 2. Wrap in a transaction to ensure atomic redemption of local balance
    const result = await db.$transaction(async (tx) => {
      // Validate Card Secret
      const secret = await tx.cardSecret.findUnique({
        where: { code },
      });

      if (!secret) {
        throw new Error('无效的卡密 (Invalid card secret)');
      }

      if (secret.value <= 0) {
        throw new Error('卡密余额不足 (Card secret balance is empty)');
      }

      // Check real price from Supplier
      const client = new HeroSMSClient(apiKey);
      const apiPrices = await client.getPrices(targetService, countryId);
      
      let apiCost = 0;
      if (apiPrices[countryId] && apiPrices[countryId][targetService]) {
        apiCost = parseFloat(apiPrices[countryId][targetService].cost || '0');
      }

      if (apiCost <= 0) {
        throw new Error('该服务当前无库存或暂不支持 (Service unavailable or out of stock)');
      }

      const finalCost = Math.ceil(apiCost * exchangeRate);

      if (secret.value < finalCost) {
        throw new Error(`余额不足。需要 ¥${finalCost}，您的余额为 ¥${secret.value} (Insufficient balance)`);
      }

      // 3. Request Number from Supplier
      let numberData;
      try {
        numberData = await client.getNumber(targetService, countryId);
      } catch (err: any) {
        throw new Error(`向上游获取号码失败 (Failed to get number): ${err.message}`);
      }

      if (!numberData || !numberData.id || !numberData.phone) {
        throw new Error('上游返回无效数据 (Supplier returned invalid number data)');
      }

      // 4. Update local DB
      // Create a local number record for this real number
      const localNumber = await tx.number.create({
        data: {
          phone: numberData.phone,
          country: countryId,
          service: targetService,
          status: 'LOCKED'
        }
      });

      // Deduct balance
      await tx.cardSecret.update({
        where: { id: secret.id },
        data: { 
          value: secret.value - finalCost,
          status: (secret.value - finalCost) > 0 ? 'UNUSED' : 'USED' 
        },
      });

      // Create Order
      const order = await tx.order.create({
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

      return order;
    }, {
      maxWait: 10000, 
      timeout: 20000 
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    console.error('Redeem error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
