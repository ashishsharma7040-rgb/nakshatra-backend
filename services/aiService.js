/**
 * ╔═══════════════════════════════════════════╗
 * ║   AI INTERPRETATION SERVICE               ║
 * ║   Google Gemini API                       ║
 * ║   Turns raw chart data into predictions   ║
 * ╚═══════════════════════════════════════════╝
 *
 * KEY ARCHITECTURE RULE:
 * We NEVER send raw birth details (DOB, time, location) to Gemini.
 * We ONLY send the calculated chart data + the user's question.
 *
 * This is important for:
 *   1. Privacy (no raw personal data sent to Google)
 *   2. Accuracy (AI interprets chart, not re-calculates it)
 *   3. Cost (shorter prompts = fewer tokens)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

/**
 * buildAstrologyPrompt
 * --------------------
 * Constructs a structured prompt for Gemini.
 * The chart data gives Gemini full context so it can give specific answers.
 *
 * @param {object} chart   - calculated chart from ephemerisService
 * @param {string} question - user's question
 * @returns {string}
 */
function buildAstrologyPrompt(chart, question) {
  const { ascendant, planets, currentDasha, moon } = chart;

  // Format planet positions into readable text
  const planetLines = Object.entries(planets)
    .map(([name, data]) => {
      const nak = data.nakshatra ? ` (${data.nakshatra.name} Nakshatra)` : '';
      return `  ${capitalize(name)}: ${data.sign} · ${ordinal(data.house)} House${nak}`;
    })
    .join('\n');

  const prompt = `
You are an expert Vedic astrologer with 30 years of experience in Jyotish (Indian astrology).
You interpret birth charts using traditional Vedic techniques: Parashari system, Nakshatras, and Vimshottari Dasha.

Be specific, personal, and insightful. Avoid generic statements.
Reference the actual planet positions and houses in your answer.
Keep your response to 3–4 focused paragraphs.
End with one practical advice the person can act on.

═══ BIRTH CHART DATA ═══

Ascendant (Lagna): ${ascendant.sign} (${ascendant.degrees}°)
  Nakshatra: ${ascendant.nakshatra?.name || 'N/A'} · Pada ${ascendant.nakshatra?.pada || 'N/A'}

Moon Sign: ${moon.sign}
Moon Nakshatra: ${moon.nakshatra?.name || 'N/A'} · Pada ${moon.nakshatra?.pada || 'N/A'} · Ruled by ${moon.nakshatra?.lord || 'N/A'}

Planet Positions:
${planetLines}

Current Dasha (Major Period): ${currentDasha?.planet} Mahadasha
  Period: ${currentDasha?.startDate} → ${currentDasha?.endDate}

════════════════════════

USER'S QUESTION:
"${question}"

Please provide your Vedic astrological interpretation:
`.trim();

  return prompt;
}

// ── Main AI call ───────────────────────────────────────────────────────────────

/**
 * getAIInterpretation
 * -------------------
 * Sends chart + question to Google Gemini, returns the AI's answer.
 *
 * @param {object} chart    - from ephemerisService.calculateBirthChart()
 * @param {string} question - user's question
 * @returns {string} AI response text
 */
async function getAIInterpretation(chart, question) {
  const prompt = buildAstrologyPrompt(chart, question);

  try {
    const client = getClient();
    const model  = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const result  = await model.generateContent(prompt);
    const response = result.response;
    const text    = response.text();

    if (!text) throw new Error('Empty response from Gemini');
    return text;

  } catch (error) {
    // Handle specific Gemini error codes
    if (error.message?.includes('API_KEY_INVALID')) {
      throw new Error('Invalid Gemini API key. Please check your .env file.');
    }
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw new Error('Gemini API quota exceeded. Please try again later.');
    }
    throw new Error(`AI interpretation failed: ${error.message}`);
  }
}

/**
 * getDailyHoroscope
 * -----------------
 * Generates a daily horoscope for the user based on their chart
 * and the current planetary transits.
 */
async function getDailyHoroscope(chart) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const prompt = `
You are a Vedic astrologer. Write a daily horoscope for ${today}.

The person has:
- Ascendant: ${chart.ascendant.sign}
- Moon Sign: ${chart.moon.sign}
- Moon Nakshatra: ${chart.moon.nakshatra?.name}
- Current Dasha: ${chart.currentDasha?.planet} Mahadasha

Write 3 short paragraphs covering:
1. General energy and mood for today
2. Career / finances today
3. Relationships / personal life today

End with one lucky element (color, number, or direction).
Keep it warm, personal, and 150 words maximum.
`.trim();

  const client = getClient();
  const model  = client.getGenerativeModel({ model: 'gemini-1.5-flash' }); // cheaper for daily horoscope
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = { getAIInterpretation, getDailyHoroscope };
