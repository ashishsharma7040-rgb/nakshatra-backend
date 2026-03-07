// services/aiService.js
// Auto-selects Gemini model based on installed SDK version
// Old SDK (^0.2.1) = gemini-pro | New SDK (^0.21.0) = gemini-1.5-flash

const { GoogleGenerativeAI } = require('@google/generative-ai');

function getModelName() {
  try {
    const pkg = require('../node_modules/@google/generative-ai/package.json');
    const version = pkg.version || '0.0.0';
    const minor = parseInt(version.split('.')[1] || '0', 10);
    // Version 0.21.0 and above supports gemini-1.5-flash
    if (minor >= 21) return 'gemini-1.5-flash';
    return 'gemini-pro';
  } catch {
    return 'gemini-pro'; // safe fallback
  }
}

function buildPrompt(chart, question, userName) {
  const { ascendant = {}, planets = {}, currentDasha } = chart;

  const planetLines = Object.entries(planets).map(([name, data]) => {
    const deg   = data.degrees != null ? ` ${Number(data.degrees).toFixed(2)}°` : '';
    const house = data.house   != null ? ` — House ${data.house}` : '';
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

=== BIRTH CHART — Sidereal · Lahiri Ayanamsa · Whole Sign Houses ===

Ascendant (Lagna): ${ascLine}

Planetary Positions:
${planetLines || 'No planetary data available.'}

${dashaLine}

=== READING RULES ===
1. Every statement MUST cite specific planets and house numbers from above.
2. Trace each planet's sign lord and where that lord sits.
3. Note exaltation, debilitation, own sign, or enemy placements.
4. Connect your answer to the active Mahadasha.
5. Mention specific yogas (Raj Yoga, Dhana Yoga, etc.) where relevant.
6. Be practical and specific — no vague generalisations.
7. Write 3-5 clear paragraphs. End with one actionable recommendation.

=== QUESTION ===
${question}

Give a detailed, chart-anchored Vedic astrological reading now.`;
}

async function getAIReading(chart, question, userName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in Render environment variables.');
  }

  const genAI     = new GoogleGenerativeAI(apiKey);
  const modelName = getModelName();
  console.log(`Using Gemini model: ${modelName}`);

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature:     0.72,
      topP:            0.88,
      maxOutputTokens: 1400,
    },
  });

  const prompt = buildPrompt(chart, question, userName);

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('404')) {
      throw new Error(`Gemini model "${modelName}" not found. Your GEMINI_API_KEY may not have access. Try regenerating at aistudio.google.com`);
    }
    if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
      throw new Error('Gemini API key is invalid or expired. Please regenerate at aistudio.google.com and update GEMINI_API_KEY on Render.');
    }
    if (msg.includes('429') || msg.includes('quota')) {
      throw new Error('Gemini API quota exceeded. Please wait a minute and try again.');
    }
    throw new Error(`Gemini error: ${msg}`);
  }

  const text = result.response.text();
  if (!text || text.trim().length < 20) {
    throw new Error('AI returned an empty response. Please try again.');
  }

  return text.trim();
}

module.exports = { getAIReading };
