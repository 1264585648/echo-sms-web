async function test() {
  const redeemRes = await fetch('http://localhost:3012/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'TESTCARD', targetService: 'tg' })
  });
  const redeemData = await redeemRes.json();
  console.log("REDEEM:", JSON.stringify(redeemData, null, 2));

  if (redeemData.success) {
    const orderId = redeemData.order.id;
    const cancelRes = await fetch(`http://localhost:3012/api/orders/${orderId}/cancel`, {
      method: 'POST'
    });
    const cancelData = await cancelRes.json();
    console.log("CANCEL:", JSON.stringify(cancelData, null, 2));
    
    // Check CardSecret balance
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const sc = await prisma.cardSecret.findUnique({where: {code: 'TESTCARD'}});
    console.log("CardSecret after cancel:", sc);
    await prisma.$disconnect();
  }
}
test();
