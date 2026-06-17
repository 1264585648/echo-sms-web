const key = '7d3ccdA7befc03AfA2469b1bbff04cf6';
const url = `https://hero-sms.com/stubs/handler_api.php?api_key=${key}&action=getPrices`;
fetch(url).then(r => r.text()).then(console.log).catch(console.error);
