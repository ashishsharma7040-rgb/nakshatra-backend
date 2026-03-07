const https = require('https');

function buildPrompt(chart, question, userName) {
  const { ascendant = {}, planets = {}, currentDasha } = chart;
  const planetLines = Object.entries(planets).map(([name, data]) => {
    return `• ${name}: ${data.sign || '?'} — House ${data.house || '?'}${data.nakshatra ? ` | ${data.nakshatra.name}` : ''}`;
  }).join('\n');
  return `You are a master Vedic astrologer. Reading for ${userName || 'the querent'}.
Ascendant: ${ascendant.sign || 'Unknown'}
Planets:\n${planetLines}
Mahadasha: ${currentDasha ? `${currentDasha.planet} until ${currentDasha.endDate}` : 'Unknown'}
Question: ${question}
Give a detailed 4-paragraph Vedic astrological answer referencing specific planets and houses.`;
}

function tryModel(apiKey, model, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        if (res.statusCode === 200) {
          resolve(p?.candidates?.[0]?.content?.parts?.[0]?.text || '');
        } else {
          reject(new Error(p?.error?.message || `HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', e => reject(e));
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function getAIReading(chart, question, userName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set on Render.');
  const prompt = buildPrompt(chart, question, userName);
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
  for (const model of models) {
    try {
      console.log('Trying:', model);
      const text = await tryModel(apiKey, model, prompt);
      if (text && text.length > 20) { console.log('Success:', model); return text.trim(); }
    } catch (e) { console.log(model, 'failed:', e.message); }
  }
  throw new Error('All Gemini models failed. Please verify GEMINI_API_KEY on Render.');
}

module.exports = { getAIReading };
