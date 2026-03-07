const https = require('https');

function buildPrompt(chart, question, userName) {
  const { ascendant = {}, planets = {}, currentDasha } = chart;
  const planetLines = Object.entries(planets).map(([name, data]) => {
    return `• ${name}: ${data.sign || '?'} — House ${data.house || '?'}${data.nakshatra ? ` | ${data.nakshatra.name}, Lord: ${data.nakshatra.lord}` : ''}`;
  }).join('\n');
  return `You are a master Vedic astrologer. Reading for ${userName || 'the querent'}.
Ascendant: ${ascendant.sign || 'Unknown'}${ascendant.nakshatra ? ` | ${ascendant.nakshatra.name}` : ''}
Mahadasha: ${currentDasha ? `${currentDasha.planet} until ${currentDasha.endDate}` : 'Unknown'}
Planets:\n${planetLines}
Question: ${question}
Give a detailed 4-paragraph Vedic astrological answer referencing specific planets, houses and the current Mahadasha.`;
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (res.statusCode === 200) {
            resolve(p?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          } else {
            reject(new Error(p?.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch(e) { reject(new Error('Parse error: ' + e.message)); }
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

  // ONLY these two exact model names — no -latest, no -pro, no old names
  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  for (const model of models) {
    try {
      console.log('Trying:', model);
      const text = await tryModel(apiKey, model, prompt);
      if (text && text.length > 20) {
        console.log('✓ Success:', model);
        return text.trim();
      }
    } catch (e) {
      console.log(model, 'failed:', e.message);
    }
  }
  throw new Error('Gemini failed. Check GEMINI_API_KEY on Render.');
}

module.exports = { getAIReading };
