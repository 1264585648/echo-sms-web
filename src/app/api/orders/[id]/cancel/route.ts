import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';
import {
  authorizeCardSecretForOrder,
  readCardSecretCodeFromHeader,
} from '@/lib/card-secret-auth';
import { readSystemConfigMap } from '@/lib/system-config';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.id;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const cardSecretCode = readCardSecretCodeFromHeader(req.headers);
    if (!cardSecretCode) {
      return NextResponse.json({ error: 'Card secret code is required' }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        supplierId: true,
        cardSecretId: true,
        cost: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const authResult = await authorizeCardSecretForOrder({
      code: cardSecretCode,
      orderCardSecretId: order.cardSecretId,
      findCardSecretByCode: (code) =>
        db.cardSecret.findUnique({
          where: { code },
          select: { id: true },
        }),
    });

    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
    }

    // Call upstream to cancel
    if (order.supplierId) {
      const config = await readSystemConfigMap(db.systemConfig, ['HERO_API_KEY']);
      const apiKey = config['HERO_API_KEY'];
      if (!apiKey) {
        return NextResponse.json({ error: 'System configuration error: Missing API Key' }, { status: 500 });
      }

      const client = new HeroSMSClient(apiKey);
      try {
        const resText = await client.setStatus(order.supplierId, 8); // 8 is cancel
        if (resText !== 'ACCESS_CANCEL') {
          return NextResponse.json({ error: `Cancellation denied by provider: ${resText}` }, { status: 400 });
        }
      } catch (e: any) {
        console.error("Upstream cancel failed:", e.message);
        return NextResponse.json({ error: 'Upstream network error during cancellation' }, { status: 502 });
      }
    }

    // Refund locally
    await db.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
      if (currentOrder?.status !== 'PENDING') return; // Idempotency check

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' }
      });
      
      await tx.cardSecret.update({
        where: { id: order.cardSecretId },
        data: { value: { increment: order.cost }, status: 'UNUSED' }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
