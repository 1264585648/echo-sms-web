import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';
import {
  authorizeCardSecretForOrder,
  readCardSecretCodeFromHeader,
} from '@/lib/card-secret-auth';

export async function GET(
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

    const orderOwnership = await db.order.findUnique({
      where: { id: orderId },
      select: { cardSecretId: true },
    });

    if (!orderOwnership) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const authResult = await authorizeCardSecretForOrder({
      code: cardSecretCode,
      orderCardSecretId: orderOwnership.cardSecretId,
      findCardSecretByCode: (code) =>
        db.cardSecret.findUnique({
          where: { code },
          select: { id: true },
        }),
    });

    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        Number: true,
        SMSLog: {
          orderBy: { receivedAt: 'desc' }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only poll upstream if status is PENDING and we have a supplierId
    if (order.status === 'PENDING' && order.supplierId) {
      const configRecords = await db.systemConfig.findMany();
      const apiKey = configRecords.find(c => c.key === 'HERO_API_KEY')?.value;

      if (apiKey) {
        const client = new HeroSMSClient(apiKey);
        try {
          const statusText = await client.getStatus(order.supplierId);
          
          if (statusText.startsWith('STATUS_OK:')) {
            const code = statusText.split(':')[1];
            
            // Transaction to save code and complete order
            await db.$transaction(async (tx) => {
              const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
              if (currentOrder?.status !== 'PENDING') return; // Idempotency check

              await tx.sMSLog.create({
                data: {
                  orderId: order.id,
                  message: `Code: ${code}`,
                  sender: 'HeroSMS'
                }
              });

              await tx.order.update({
                where: { id: order.id },
                data: { status: 'COMPLETED' }
              });
            });

            // Re-fetch to return latest
            const updatedOrder = await db.order.findUnique({
              where: { id: orderId },
              include: { Number: true, SMSLog: { orderBy: { receivedAt: 'desc' } } }
            });
            return NextResponse.json({ success: true, order: updatedOrder });

          } else if (statusText === 'STATUS_CANCEL') {
             // Upstream cancelled
             await db.$transaction(async (tx) => {
               const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
               if (currentOrder?.status !== 'PENDING') return; // Idempotency check

               await tx.order.update({
                 where: { id: order.id },
                 data: { status: 'REFUNDED' }
               });
               
               // Refund to CardSecret
               await tx.cardSecret.update({
                 where: { id: order.cardSecretId },
                 data: { value: { increment: order.cost }, status: 'UNUSED' }
               });
             });

             const updatedOrder = await db.order.findUnique({
               where: { id: orderId },
               include: { Number: true, SMSLog: true }
             });
             return NextResponse.json({ success: true, order: updatedOrder });
          }
        } catch (e: any) {
          console.error("Error checking upstream status:", e.message);
        }
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Fetch order error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
