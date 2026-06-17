async function test() {
  // Test inventory
  const res = await fetch('http://localhost:3012/api/inventory');
  const data = await res.json();
  console.log("INVENTORY:", JSON.stringify(data, null, 2));

  // Test redeem
  const redeemRes = await fetch('http://localhost:3012/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'TESTCARD', targetService: 'tg' })
  });
  const redeemData = await redeemRes.json();
  console.log("REDEEM:", JSON.stringify(redeemData, null, 2));

  if (redeemData.success) {
    const orderId = redeemData.order.id;
    // Test poll
    const pollRes = await fetch(`http://localhost:3012/api/orders/${orderId}`);
    const pollData = await pollRes.json();
    console.log("POLL:", JSON.stringify(pollData, null, 2));
  }
}
test();
