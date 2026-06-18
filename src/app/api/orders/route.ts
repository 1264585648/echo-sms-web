import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readCardSecretCodeFromJsonBody } from '@/lib/card-secret-auth';

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: Request) {
  try {
    const code = await readCardSecretCodeFromJsonBody(req);

    if (!code) {
      return NextResponse.json({ error: 'Card secret code is required' }, { status: 401 });
    }

    const secret = await db.cardSecret.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all unresolved orders explicitly to prevent funds lock
    const pendingOrders = await db.order.findMany({
      where: {
        cardSecretId: secret.id,
        status: { in: ['PENDING', 'ACTIVE'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        Number: true,
        SMSLog: { orderBy: { receivedAt: 'desc' } }
      }
    });

    // Fetch up to 10 most recent resolved orders
    const resolvedOrders = await db.order.findMany({
      where: {
        cardSecretId: secret.id,
        status: { notIn: ['PENDING', 'ACTIVE'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        Number: true,
        SMSLog: { orderBy: { receivedAt: 'desc' } }
      }
    });

    const orders = [...pendingOrders, ...resolvedOrders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
