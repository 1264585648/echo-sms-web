import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';

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

    const order = await db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
    }

    // Call upstream to cancel
    if (order.supplierId) {
      const configRecords = await db.systemConfig.findMany();
      const apiKey = configRecords.find(c => c.key === 'HERO_API_KEY')?.value;
      if (apiKey) {
        const client = new HeroSMSClient(apiKey);
        try {
          await client.setStatus(order.supplierId, 8); // 8 is cancel
        } catch (e: any) {
          console.error("Upstream cancel failed (might already be cancelled):", e.message);
        }
      }
    }

    // Refund locally
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' }
      });
      
      const secret = await tx.cardSecret.findUnique({ where: { id: order.cardSecretId } });
      if (secret) {
        await tx.cardSecret.update({
          where: { id: secret.id },
          data: { value: secret.value + order.cost }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
