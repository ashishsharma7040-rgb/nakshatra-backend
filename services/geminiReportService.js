// services/geminiReportService.js
// Uses Gemini AI to generate deeply personalised PDF report sections
// Called once per report — generates ALL sections in parallel

const https = require('https');

// ── Core Gemini caller (same pattern as aiService.js) ─────────────────────────
function callGemini(apiKey, prompt, maxTokens = 1800) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: maxTokens }
    });
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

    const tryModel = (idx) => {
      if (idx >= models.length) return reject(new Error('All Gemini models failed'));
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${models[idx]}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const p = JSON.parse(d);
            if (res.statusCode === 200) {
              const text = p?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text.length > 30) resolve(text.trim());
              else tryModel(idx + 1);
            } else {
              console.log(`Gemini ${models[idx]} failed (${res.statusCode}), trying next`);
              tryModel(idx + 1);
            }
          } catch(e) { tryModel(idx + 1); }
        });
      });
      req.on('error', () => tryModel(idx + 1));
      req.setTimeout(30000, () => { req.destroy(); tryModel(idx + 1); });
      req.write(body);
      req.end();
    };
    tryModel(0);
  });
}

// ── Build compact chart summary for prompts ───────────────────────────────────
function chartSummary(chartData, userName, dob, birthTime, birthPlace, yogas, currentDasha) {
  const { ascendant = {}, planets = {} } = chartData;
  const planetLines = Object.entries(planets).map(([name, data]) =>
    `${name}: ${data.sign || '?'} H${data.house || '?'} ${data.nakshatra?.name || ''} ${data.retrograde ? '(R)' : ''}`
  ).join(' | ');

  const yogaNames = (yogas || []).map(y => y.name).join(', ') || 'None detected';
  const dashaStr  = currentDasha ? `${currentDasha.planet} Mahadasha until ${String(currentDasha.endDate).slice(0,10)}` : 'Unknown';

  return `
Native: ${userName}
DOB: ${dob} | Time: ${birthTime} | Place: ${birthPlace}
Ascendant: ${ascendant.sign} (${ascendant.nakshatra?.name || ''}, Pada ${ascendant.nakshatra?.pada || ''})
Moon Sign: ${planets.moon?.sign || '?'} | Sun Sign: ${planets.sun?.sign || '?'}
Current Dasha: ${dashaStr}
Yogas present: ${yogaNames}
Planets: ${planetLines}
`.trim();
}

// ── Master prompt builder ─────────────────────────────────────────────────────
function buildSectionPrompt(section, chart, userName, dob, birthTime, birthPlace, yogas, currentDasha) {
  const summary = chartSummary(chart, userName, dob, birthTime, birthPlace, yogas, currentDasha);

  const BASE = `You are a master Vedic astrologer with 30 years of experience, deeply versed in BPHS, Phaladeepika, Jataka Parijata, Sarvartha Chintamani, and Brihat Jataka. You are writing a section of a premium printed horoscope report for ${userName}. Write in a warm, wise, authoritative tone — like a learned Jyotishi speaking directly to the native. Use specific planet positions, house numbers, and nakshatra names from the chart. Reference classical texts by name where appropriate. Write flowing paragraphs, NOT bullet points. Every sentence must be specific to THIS chart, not generic. Minimum 250 words.

BIRTH CHART DATA:
${summary}`;

  const prompts = {

    lagnaAnalysis: `${BASE}

Write the Ascendant (Lagna) Analysis section. Cover:
- The deep character, personality, and physical nature of this Lagna
- How the Lagna lord's position specifically shapes this person's life path
- The Nakshatra of the Ascendant and its specific influence on personality
- Key strengths and natural gifts this native was born with
- The dharmic purpose indicated by this Lagna
Cite specific house positions and nakshatra names from the chart above.`,

    careerAnalysis: `${BASE}

Write the Career & Life Purpose section. Cover:
- The 10th house sign, planets in it, and 10th lord position — what career fields are specifically indicated
- How the Ascendant lord supports or challenges career path
- The role of Saturn (Karma karaka) in this chart's career story
- What the current Mahadasha means for career right now
- Specific professions, industries, and working styles that align with this chart
- When the peak career period is likely based on Dasha sequence
Make every sentence specific to the planets and houses shown above.`,

    financeAnalysis: `${BASE}

Write the Finance & Wealth Potential section. Cover:
- The 2nd house (accumulated wealth) and its lord's position
- The 11th house (income, gains) and its lord's position  
- Any Dhana Yogas (wealth combinations) present in this specific chart
- Jupiter's role as Dhana karaka — where it sits and what it promises
- The current Dasha's impact on financial matters
- Practical guidance on the best timing and methods for wealth creation for this native
- Specific wealth-building strengths and cautions from this chart
Every claim must reference an actual planet and house from the chart data above.`,

    marriageAnalysis: `${BASE}

Write the Marriage & Relationships section. Cover:
- The 7th house (marriage), its sign, planets in it, and 7th lord's placement
- Venus's position — sign, house, nakshatra — and what it reveals about relationship nature and spouse qualities
- Jupiter's role for the native (karaka for husband in female charts, for wife's wisdom in male charts)
- Whether Mangal Dosha is present and its specific nature in this chart
- The likely qualities, nature, and background of the life partner
- Timing indicators — which Dasha or transit periods favour marriage
- Guidance for a harmonious relationship life based on classical Jyotish
Cite specific planets, signs, and houses from the chart above.`,

    healthAnalysis: `${BASE}

Write the Health & Vitality section. Cover:
- The Ascendant sign and what body parts and constitution it governs
- The 6th house (disease), its lord, and any planets placed there
- The 8th house (longevity) — planets and lord position
- Saturn and Mars placements and their specific health implications for this chart
- The Moon's condition and its impact on mental and emotional health
- Which health areas require the most attention based on planetary positions
- Seasonal and lifestyle recommendations aligned with this chart's constitution
- Whether current Dasha activates any health-sensitive areas
Make every point specific to the exact planetary positions in the chart above.`,

    spiritualPath: `${BASE}

Write the Spiritual Path & Dharma section. Cover:
- The 9th house (dharma, higher wisdom) — its sign, lord, and any planets there
- The 12th house (moksha, liberation) — planets and lord placement
- Ketu's position and what past life spiritual gifts it brings to this life
- Jupiter's position and its role in guiding this native's spiritual development
- The specific spiritual practices, deities, and paths most suited to this chart
- How the current Mahadasha relates to the native's spiritual journey
- The deeper soul purpose shown by the Rahu-Ketu axis in this chart
Write with reverence and depth, referencing specific nakshatras and classical teachings.`,

    personalitySummary: `${BASE}

Write a Personality & Life Overview summary section to close the report. Cover:
- The unique cosmic signature of this birth chart — what makes this person special
- The interplay of all major planets and how they create this individual's destiny
- The 3 greatest strengths clearly shown in this chart
- The 3 key life lessons this soul came to learn
- How the yogas present elevate this native's potential
- An inspiring, personalised closing message that references specific elements of their chart
- End with a Sanskrit blessing appropriate to their Lagna and Nakshatra
Write this as a beautiful, moving conclusion that the native will treasure for life.`,

    remedies: `${BASE}

Write the Recommended Remedies section. For each remedy, explain WHY it is prescribed based on a specific planet or placement in this chart. Cover:
- Specific mantras for the planets that most need strengthening or pacifying in THIS chart (cite the exact planet and why)
- Gemstone recommendations with important cautions — be specific about which gem helps which planet and why based on this chart
- Charity and donation prescriptions tied to specific planets in challenging positions
- Fasting days and ritual practices most beneficial for this Lagna
- Deity worship recommendations based on the Ishta Devata shown by this chart
- Any specific temple or pilgrimage indicated by the chart
- Simple daily practices this native can begin immediately
Every remedy must connect to a specific planet, house, or yoga in this chart — nothing generic.`,
  };

  return prompts[section];
}

// ── Generate all AI sections for a report ────────────────────────────────────
async function generateAISections(chartData, userName, dob, birthTime, birthPlace, yogas, currentDasha, type) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set — skipping AI generation');
    return {};
  }

  // Basic report sections
  const basicSections = ['lagnaAnalysis', 'personalitySummary'];

  // Detailed report adds all sections
  const detailedSections = [
    'lagnaAnalysis',
    'careerAnalysis',
    'financeAnalysis',
    'marriageAnalysis',
    'healthAnalysis',
    'spiritualPath',
    'remedies',
    'personalitySummary',
  ];

  const sections = type === 'detailed' ? detailedSections : basicSections;
  const results  = {};

  console.log(`Generating ${sections.length} AI sections for ${userName} (${type} report)...`);

  // Run sections sequentially to avoid rate limits
  for (const section of sections) {
    try {
      console.log(`  Generating: ${section}`);
      const prompt = buildSectionPrompt(section, chartData, userName, dob, birthTime, birthPlace, yogas, currentDasha);
      const text   = await callGemini(apiKey, prompt, type === 'detailed' ? 1800 : 1200);
      results[section] = text;
      console.log(`  ✓ ${section} (${text.length} chars)`);
      // Small delay between calls to respect rate limits
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`  ✗ ${section} failed:`, err.message);
      results[section] = null; // will fall back to static text in PDF
    }
  }

  console.log(`AI generation complete: ${Object.values(results).filter(Boolean).length}/${sections.length} sections`);
  return results;
}

module.exports = { generateAISections };
