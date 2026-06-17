import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { numberId, message, sender } = await req.json();

    if (!numberId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Find active order for this number
      const activeOrder = await tx.order.findFirst({
        where: {
          numberId: numberId,
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      });

      if (!activeOrder) {
        throw new Error('No active order found for this number');
      }

      // Create SMS Log
      const smsLog = await tx.sMSLog.create({
        data: {
          orderId: activeOrder.id,
          message,
          sender: sender || 'Unknown',
        },
      });

      // Mark Order as COMPLETED
      await tx.order.update({
        where: { id: activeOrder.id },
        data: { status: 'COMPLETED' },
      });

      // Mark Number as USED (or AVAILABLE depending on business logic, here we say USED)
      await tx.number.update({
        where: { id: numberId },
        data: { status: 'USED' },
      });

      return smsLog;
    });

    return NextResponse.json({ success: true, log: result });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
