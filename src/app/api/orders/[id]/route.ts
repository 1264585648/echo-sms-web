import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HeroSMSClient } from '@/lib/hero-sms';

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
               await tx.order.update({
                 where: { id: order.id },
                 data: { status: 'REFUNDED' }
               });
               
               // Refund to CardSecret
               const secret = await tx.cardSecret.findUnique({ where: { id: order.cardSecretId } });
               if (secret) {
                 await tx.cardSecret.update({
                   where: { id: secret.id },
                   data: { value: secret.value + order.cost }
                 });
               }
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
