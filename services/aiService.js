// services/aiService.js
// Direct HTTPS call to Gemini REST API — no SDK needed at all
// Uses v1beta which supports all models including gemini-1.5-flash

const https = require('https');

function buildPrompt(chart, question, userName) {
  const { ascendant = {}, planets = {}, currentDasha } = chart;

  const planetLines = Object.entries(planets).map(([name, data]) => {
    const deg   = data.degrees  != null ? ` ${Number(data.degrees).toFixed(2)}°` : '';
    const house = data.house    != null ? ` — House ${data.house}` : '';
    const retro = data.retrograde ? ' [Retrograde]' : '';
    const nak   = data.nakshatra
      ? ` | ${data.nakshatra.name} Nakshatra, Pada ${data.nakshatra.pada || '?'}, Lord: ${data.nakshatra.lord || '?'}`
      : '';
    return `• ${name.charAt(0).toUpperCase() + name.slice(1)}: ${data.sign || '?'}${deg}${house}${retro}${nak}`;
  }).join('\n');

  const ascLine = ascendant.sign
    ? `${ascendant.sign}${ascendant.degrees != null ? ` ${Number(ascendant.degrees).toFixed(2)}°` : ''}${ascendant.nakshatra ? ` | ${ascendant.nakshatra.name}, Lord: ${ascendant.nakshatra.lord}` : ''}`
    : 'Unknown';

  const dashaLine = currentDasha
    ? `Active Mahadasha: ${currentDasha.planet} (${currentDasha.startDate} to ${currentDasha.endDate})`
    : 'Dasha period: not available';

  return `You are a master Vedic astrologer (Jyotish) with deep knowledge of BPHS, Phaladeepika, and Jataka Parijata.

You are reading for ${userName || 'the querent'}.

=== BIRTH CHART (Sidereal, Lahiri Ayanamsa, Whole Sign Houses) ===

Ascendant (Lagna): ${ascLine}

Planetary Positions:
${planetLines || 'No planetary data available.'}

${dashaLine}

=== READING RULES ===
1. Every statement MUST cite specific planets and house numbers from the chart above.
2. Trace each planet sign lord and where that lord sits.
3. Note exaltation, debilitation, own sign, or enemy placements.
4. Connect your answer to the active Mahadasha planet.
5. Mention specific yogas (Raj Yoga, Dhana Yoga etc.) where relevant.
6. Be practical and specific — no vague generalisations.
7. Write 3-5 clear paragraphs. End with one actionable recommendation.

=== QUESTION ===
${question}

Give a detailed, chart-anchored Vedic astrological reading now.`;
}

function callGemini(apiKey, model, prompt) {
  return new Promise((resolve, reject) => {
    const bodyObj = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.72,
        topP:            0.88,
        maxOutputTokens: 1400,
      },
    };
    const body = JSON.stringify(bodyObj);

    // Use v1beta — supports ALL Gemini models including 1.5-flash
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port:     443,
      path:     `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.error?.message || data}`));
            return;
          }
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch (e) {
          reject(new Error(`Response parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Gemini request timed out. Please try again.'));
    });

    req.write(body);
    req.end();
  });
}

async function getAIReading(chart, question, userName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it in Render environment variables.');
  }

  const prompt = buildPrompt(chart, question, userName);

  // Try models in order — gemini-1.5-flash is best on v1beta
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log(`Trying Gemini model: ${model} (v1beta)`);
      const text = await callGemini(apiKey, model, prompt);
      if (text && text.trim().length > 20) {
        console.log(`✓ Success with: ${model}`);
        return text.trim();
      }
      console.warn(`${model} returned empty response`);
    } catch (err) {
      console.warn(`${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(
    `Gemini could not respond. Check your GEMINI_API_KEY at aistudio.google.com. Error: ${lastError?.message}`
  );
}

module.exports = { getAIReading };
