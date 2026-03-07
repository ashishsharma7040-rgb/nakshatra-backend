// services/aiService.js
// Builds a Vedic Jyotish prompt from real chart data and calls Google Gemini.

const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function buildPrompt(chart, question, userName) {
  const { ascendant, planets, currentDasha } = chart;

  const planetLines = Object.entries(planets || {}).map(([name, data]) => {
    const nak = data.nakshatra
      ? ` (${data.nakshatra.name}, Pada ${data.nakshatra.pada || '?'}, lord: ${data.nakshatra.lord})`
      : '';
    return `• ${name.charAt(0).toUpperCase() + name.slice(1)}: ${data.sign} ${data.degrees?.toFixed(1) || ''}° — House ${data.house}${nak}`;
  }).join('\n');

  const ascNak = ascendant?.nakshatra
    ? `${ascendant.sign} (${ascendant.nakshatra.name}, lord: ${ascendant.nakshatra.lord})`
    : ascendant?.sign || 'Unknown';

  const dashaInfo = currentDasha
    ? `Current Mahadasha: ${currentDasha.planet} (${currentDasha.startDate} to ${currentDasha.endDate})`
    : 'Dasha: unavailable';

  return `You are an expert Vedic astrologer (Jyotish) with mastery of classical texts including Brihat Parashara Hora Shastra and Phaladeepika.

You are giving a personal reading to ${userName || 'the querent'}.

=== NATAL CHART (Sidereal Lahiri Ayanamsa, Whole Sign Houses) ===

Ascendant (Lagna): ${ascNak}

Planetary Positions:
${planetLines}

${dashaInfo}

=== RULES FOR YOUR READING ===
1. Reference specific planets and their house placements from the chart above.
2. Consider the lord of each house and where it sits.
3. Note if any planets are in exaltation, debilitation, own sign, or mutual aspect.
4. Always connect your answer to the current dasha period.
5. Give practical, specific guidance — not vague generalisations.
6. Mention specific yogas (planetary combinations) if relevant.
7. Keep your answer to 3–5 well-structured paragraphs.
8. Address the querent by name: ${userName}.

=== THE QUERENT'S QUESTION ===
${question}

Give a detailed, chart-specific Vedic astrological reading. Every statement must be anchored in the actual planetary positions listed above.`;
}

async function getAIReading(chart, question, userName) {
  const genAI = getGenAI();

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature:     0.7,
      topP:            0.85,
      maxOutputTokens: 1200,
    },
  });

  const prompt = buildPrompt(chart, question, userName);
  const result = await model.generateContent(prompt);
  const text   = result.response.text();

  if (!text || text.trim().length < 20) {
    throw new Error('AI returned an empty response. Please try again.');
  }

  return text.trim();
}

module.exports = { getAIReading };
