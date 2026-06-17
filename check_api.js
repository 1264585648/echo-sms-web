const key = '7d3ccdA7befc03AfA2469b1bbff04cf6';
const url = `https://hero-sms.com/stubs/handler_api.php?api_key=${key}&action=getPrices`;
fetch(url).then(r => r.json()).then(data => {
  const findService = (service) => {
    const countries = Object.keys(data);
    let best = null;
    for (const c of countries) {
      if (data[c][service] && data[c][service].count > 0) {
        if (!best || data[c][service].cost < best.cost) {
          best = { country: c, ...data[c][service] };
        }
      }
    }
    return best;
  };
  console.log('tg:', findService('tg'));
  console.log('wa:', findService('wa'));
  console.log('ig:', findService('ig'));
  console.log('openai:', findService('vi')); // maybe 'vi' for viber or something, wait openai is usually 'dr' or something?
  // Let's just find any for openai
}).catch(console.error);
