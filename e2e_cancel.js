async function test() {
  const cardSecretCode = 'TESTCARD';
  const redeemRes = await fetch('http://localhost:3012/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: cardSecretCode, targetService: 'tg', countryId: '0' })
  });
  const redeemData = await redeemRes.json();
  console.log("REDEEM:", JSON.stringify(redeemData, null, 2));

  if (redeemData.success) {
    const orderId = redeemData.order.id;
    const cancelRes = await fetch(`http://localhost:3012/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'x-card-secret-code': cardSecretCode }
    });
    const cancelData = await cancelRes.json();
    console.log("CANCEL:", JSON.stringify(cancelData, null, 2));
    
    // Check CardSecret balance
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const sc = await prisma.cardSecret.findUnique({where: {code: cardSecretCode}});
    console.log("CardSecret after cancel:", sc ? {
      idSuffix: sc.id.slice(-6),
      value: sc.value,
      status: sc.status,
      code: `${sc.code.slice(0, 2)}***${sc.code.slice(-2)}`,
    } : null);
    await prisma.$disconnect();
  }
}
test();
