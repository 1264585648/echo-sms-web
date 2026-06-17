const key = '7d3ccdA7befc03AfA2469b1bbff04cf6';
const url = `https://hero-sms.com/stubs/handler_api.php?api_key=${key}&action=getPrices`;
fetch(url).then(r => r.json()).then(data => {
  console.log('Total countries:', Object.keys(data).length);
  console.log(Object.keys(data));
}).catch(console.error);
