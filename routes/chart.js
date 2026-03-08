// routes/chart.js
const express  = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth    = require('../middleware/auth');
const { pool }       = require('../services/dbService');
const { geocode }    = require('../services/geocodingService');
const { calculateChart } = require('../services/ephemerisService');
const {
  PLANET_IN_HOUSE, HOUSE_SIGNIFICATIONS, SIGN_INFO, PLANET_NATURE,
  detectYogas, getDashaInterpretation, getLagnaInterpretation, calcPanchang
} = require('../services/reportService');

const router = express.Router();

// ── Credit costs ───────────────────────────────────────────────────────────────
const CREDIT_COSTS = {
  ai_question:      1,
  basic_report:     5,
  detailed_report: 10,
};

// ── POST /api/chart/generate ───────────────────────────────────────────────────
router.post('/generate',
  requireAuth,
  [
    body('dob').notEmpty().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('DOB must be YYYY-MM-DD'),
    body('time').notEmpty().matches(/^\d{2}:\d{2}$/).withMessage('Time must be HH:MM'),
    body('location').trim().notEmpty().withMessage('Birth location is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { dob, time, location } = req.body;
    const dobDate = new Date(dob);
    const today   = new Date(); today.setHours(0,0,0,0);
    if (dobDate >= today) return res.status(400).json({ error: 'Date of birth cannot be today or in the future.' });
    const ageYears = (today - dobDate) / (365.25 * 24 * 3600 * 1000);
    if (ageYears > 120) return res.status(400).json({ error: 'Date of birth cannot be more than 120 years ago.' });

    try {
      let geoData;
      try { geoData = await geocode(location); }
      catch (geoErr) { return res.status(400).json({ error: geoErr.message }); }

      let chartData;
      try { chartData = await calculateChart({ dob, time, latitude: geoData.lat, longitude: geoData.lon }); }
      catch (calcErr) { return res.status(500).json({ error: 'Planetary calculation failed. Please try again.' }); }

      await pool.query(
        `INSERT INTO charts (user_id, dob, birth_time, birth_place, latitude, longitude, chart_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id) DO UPDATE SET
           dob=EXCLUDED.dob, birth_time=EXCLUDED.birth_time, birth_place=EXCLUDED.birth_place,
           latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
           chart_data=EXCLUDED.chart_data, updated_at=NOW()`,
        [req.user.id, dob, time, geoData.displayName || location, geoData.lat, geoData.lon, JSON.stringify(chartData)]
      );

      const userRow = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
      const credits = userRow.rows[0]?.credits ?? 0;

      return res.json({ chart: chartData, birthPlace: geoData.displayName || location, latitude: geoData.lat, longitude: geoData.lon, credits });
    } catch (err) {
      console.error('Generate chart error:', err.message);
      return res.status(500).json({ error: 'Chart generation failed. Please try again.' });
    }
  }
);

// ── GET /api/chart/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT chart_data, dob, birth_time, birth_place, latitude, longitude, updated_at FROM charts WHERE user_id=$1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No chart found. Please generate your birth chart first.' });
    const row = result.rows[0];
    return res.json({ chart: { chart_data: row.chart_data, dob: row.dob, birth_time: row.birth_time, birth_place: row.birth_place, latitude: row.latitude, longitude: row.longitude, updated_at: row.updated_at } });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load chart.' });
  }
});

// ── POST /api/chart/report ─────────────────────────────────────────────────────
// Generates HTML content for PDF (frontend renders + downloads)
router.post('/report',
  requireAuth,
  [body('type').isIn(['basic','detailed']).withMessage('type must be basic or detailed')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type } = req.body;
    const cost = type === 'basic' ? CREDIT_COSTS.basic_report : CREDIT_COSTS.detailed_report;
    const userId = req.user.id;

    try {
      // Check credits
      const userRow = await pool.query('SELECT name, credits FROM users WHERE id=$1', [userId]);
      if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      const { name: userName, credits } = userRow.rows[0];
      if (credits < cost) return res.status(402).json({ error: `Insufficient credits. ${type === 'basic' ? 'Basic' : 'Detailed'} report requires ${cost} credits. You have ${credits}.`, creditsRequired: cost, creditsAvailable: credits });

      // Load chart
      const chartRow = await pool.query('SELECT chart_data, dob, birth_time, birth_place FROM charts WHERE user_id=$1', [userId]);
      if (chartRow.rows.length === 0) return res.status(400).json({ error: 'No chart found. Please generate your birth chart first.' });

      const { chart_data: chartData, dob, birth_time: birthTime, birth_place: birthPlace } = chartRow.rows[0];

      // Build report data
      const reportData = buildReportData(chartData, userName, dob, birthTime, birthPlace, type);

      // Deduct credits
      const updated = await pool.query('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits>=$1 RETURNING credits', [cost, userId]);
      if (updated.rows.length === 0) return res.status(402).json({ error: 'Credit deduction failed. Please try again.' });

      return res.json({
        success: true,
        creditsRemaining: updated.rows[0].credits,
        reportData,
        type,
        generatedAt: new Date().toISOString(),
      });

    } catch (err) {
      console.error('Report generation error:', err.message);
      return res.status(500).json({ error: 'Report generation failed. Please try again.' });
    }
  }
);

// ── GET /api/chart/report-cost ─────────────────────────────────────────────────
router.get('/report-cost', requireAuth, (req, res) => {
  res.json({ basic: CREDIT_COSTS.basic_report, detailed: CREDIT_COSTS.detailed_report });
});

// ── Build Report Data ─────────────────────────────────────────────────────────
function buildReportData(chart, userName, dob, birthTime, birthPlace, type) {
  const { ascendant = {}, planets = {}, currentDasha, dashaSequence = [] } = chart;
  const ascSign  = ascendant.sign || 'Unknown';
  const panchang = calcPanchang(chart, dob, birthTime);
  const yogas    = detectYogas(planets, ascendant);

  // Age calculation
  const age = dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000)) : '';

  // Format dob nicely
  const dobFormatted = dob ? new Date(dob + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '';

  // Planet table
  const planetTable = Object.entries(planets).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    symbol: { sun:'☉', moon:'☽', mars:'♂', mercury:'☿', jupiter:'♃', venus:'♀', saturn:'♄', rahu:'☊', ketu:'☋' }[name] || '•',
    sign: data.sign || '—',
    degrees: data.degrees ? `${data.degrees.toFixed(2)}°` : '—',
    house: data.house || '—',
    nakshatra: data.nakshatra?.name || '—',
    pada: data.nakshatra?.pada || '—',
    lord: data.nakshatra?.lord || '—',
    retrograde: data.retrograde ? 'Yes (℞)' : 'No',
    status: getPlanetStatus(name, data.sign, data.degrees),
    nature: PLANET_NATURE[name] || {},
  }));

  // Planet in house interpretations
  const planetInterpretations = planetTable.map(p => ({
    ...p,
    houseInterpretation: PLANET_IN_HOUSE[p.name.toLowerCase()]?.[p.house - 1] || '',
  }));

  // Ascendant
  const ascNakshatra = ascendant?.nakshatra?.name || '';
  const lagnaInterp  = getLagnaInterpretation(ascSign);
  const signInfo     = SIGN_INFO[ascSign] || {};

  // Dasha
  const dashaInterp  = currentDasha ? getDashaInterpretation(currentDasha.planet, chart) : '';

  const data = {
    // Identity
    userName, dob: dobFormatted, birthTime, birthPlace, age,
    // Chart core
    ascendant: ascSign, ascNakshatra,
    ascPada: ascendant?.nakshatra?.pada || '',
    ascDegrees: ascendant.degrees ? `${ascendant.degrees.toFixed(2)}°` : '',
    // Signs & nakshatras
    moonSign: planets.moon?.sign || '—',
    sunSign: planets.sun?.sign || '—',
    moonNakshatra: planets.moon?.nakshatra?.name || '—',
    sunNakshatra: planets.sun?.nakshatra?.name || '—',
    // Panchang
    panchang,
    // Planets
    planetTable,
    planetInterpretations,
    // Lagna
    lagnaInterp, signInfo,
    // Yogas & doshas
    yogas,
    // Dasha
    currentDasha, dashaInterp, dashaSequence,
    // Houses
    houseSignifications: HOUSE_SIGNIFICATIONS,
    // Planets by house (for kundli display)
    planetsByHouse: getPlanetsByHouse(planets, ascendant),
  };

  if (type === 'detailed') {
    data.careerPrediction    = buildCareerPrediction(planets, ascendant, ascSign, currentDasha);
    data.financePrediction   = buildFinancePrediction(planets, ascendant, ascSign);
    data.marriagePrediction  = buildMarriagePrediction(planets, ascendant, ascSign);
    data.healthPrediction    = buildHealthPrediction(planets, ascendant, ascSign);
    data.spiritualPath       = buildSpiritualPath(planets, ascendant, ascSign);
    data.remedies            = buildRemedies(planets, ascendant, yogas);
    data.lifeSummary         = buildLifeSummary(planets, ascendant, ascSign, currentDasha, yogas, userName);
  }

  return data;
}

function getPlanetsByHouse(planets, ascendant) {
  const byHouse = {};
  for (let i = 1; i <= 12; i++) byHouse[i] = [];
  Object.entries(planets).forEach(([name, data]) => {
    const h = data.house;
    if (h && byHouse[h]) {
      byHouse[h].push({ name: name.charAt(0).toUpperCase() + name.slice(1), symbol: { sun:'☉', moon:'☽', mars:'♂', mercury:'☿', jupiter:'♃', venus:'♀', saturn:'♄', rahu:'☊', ketu:'☋' }[name] || '•' });
    }
  });
  return byHouse;
}

function getPlanetStatus(name, sign, degrees) {
  const EXALTATION   = { sun:'Aries', moon:'Taurus', mars:'Capricorn', mercury:'Virgo', jupiter:'Cancer', venus:'Pisces', saturn:'Libra', rahu:'Gemini', ketu:'Sagittarius' };
  const DEBILITATION = { sun:'Libra', moon:'Scorpio', mars:'Cancer', mercury:'Pisces', jupiter:'Capricorn', venus:'Virgo', saturn:'Aries', rahu:'Sagittarius', ketu:'Gemini' };
  const OWN_SIGNS    = { sun:['Leo'], moon:['Cancer'], mars:['Aries','Scorpio'], mercury:['Gemini','Virgo'], jupiter:['Sagittarius','Pisces'], venus:['Taurus','Libra'], saturn:['Capricorn','Aquarius'] };
  const exDeg        = { sun:10, moon:3, mars:28, mercury:15, jupiter:5, venus:27, saturn:20 };

  if (!sign) return 'Unknown';
  if (EXALTATION[name] === sign) {
    const isExact = degrees && exDeg[name] && Math.abs(degrees - exDeg[name]) < 3;
    return isExact ? 'Exalted (Maximum Power)' : 'Exalted';
  }
  if (DEBILITATION[name] === sign) return 'Debilitated (Neecha — requires remedy)';
  if (OWN_SIGNS[name]?.includes(sign)) return 'Own Sign (Swakshetra — strong)';
  return 'Normal';
}

function buildCareerPrediction(planets, asc, ascSign, dasha) {
  const p = planets;
  const h10 = Object.values(p).find(x => x.house === 10);
  const sun  = p.sun?.house, mars = p.mars?.house, saturn = p.saturn?.house;
  let pred = `Career Analysis for ${ascSign} Lagna:\n\n`;
  pred += `Based on the Parashari system and Jataka Parijata, the 10th house governs career, reputation, and public life. `;
  if (p.sun && [1,4,7,10].includes(p.sun.house)) pred += 'The Sun in a kendra creates natural leadership ability — positions of authority and government connections support your career. ';
  if (p.jupiter && [1,4,7,10].includes(p.jupiter.house)) pred += 'Jupiter in a kendra brings dharmic career opportunities — teaching, counseling, law, and consulting are highlighted. ';
  if (p.saturn && [1,4,7,10].includes(p.saturn.house)) pred += 'Saturn powerfully placed creates lasting professional authority through disciplined effort and consistent service. ';
  if (dasha) pred += `\n\nDuring the current ${dasha.planet} Mahadasha, career matters are influenced by this planet's significations. `;
  pred += '\n\nCareer success is assured through steady effort, ethical practice, and alignment with your natural planetary strengths as indicated above.';
  return pred;
}

function buildFinancePrediction(planets, asc, ascSign) {
  const p = planets;
  let pred = `Wealth Analysis for ${ascSign} Lagna:\n\n`;
  pred += 'The 2nd house governs accumulated wealth and the 11th governs income — both must be analysed alongside the Dhana yogas present. ';
  if (p.jupiter && [2,5,9,11].includes(p.jupiter.house)) pred += 'Jupiter in a wealth-supporting house (2nd, 5th, 9th, or 11th) creates natural Dhana Yoga — wealth flows through wisdom and dharmic activity. ';
  if (p.venus && [2,5,9,11].includes(p.venus.house)) pred += 'Venus in a favorable house creates wealth through artistic, luxury, or relationship-based income. ';
  if (p.saturn && p.saturn.house === 11) pred += 'Saturn in the 11th house creates slow but permanent wealth accumulation — patience brings financial permanence. ';
  pred += '\n\nOverall financial trajectory is positive with the right disciplines applied to earning, saving, and investing aligned with your planetary periods.';
  return pred;
}

function buildMarriagePrediction(planets, asc, ascSign) {
  const p = planets;
  let pred = `Marriage and Relationship Analysis for ${ascSign} Lagna:\n\n`;
  pred += 'The 7th house governs marriage and partnerships. Venus and Jupiter represent marital happiness for male and female charts respectively. ';
  if (p.venus && [1,4,7,10].includes(p.venus.house)) pred += 'Venus powerfully placed in a kendra creates an attractive, harmonious marriage. The spouse is likely artistic, refined, and affectionate. ';
  if (p.jupiter && [1,4,7,10].includes(p.jupiter.house)) pred += 'Jupiter in a kendra blesses with a wise, dharmic spouse who brings expansion and fortune. ';
  if (p.mars && [1,4,7,8,12].includes(p.mars.house)) pred += 'Mars Dosha is present — matching with a partner of equal Dosha or performing Mangal puja ensures a harmonious marriage. Patience in matters of heart is advised. ';
  pred += '\n\nMarriage brings fulfillment when entered at the right time and with the right intentions — your chart indicates partnership is a key life theme for growth and joy.';
  return pred;
}

function buildHealthPrediction(planets, asc, ascSign) {
  const signInfo = SIGN_INFO[ascSign] || {};
  let pred = `Health Analysis for ${ascSign} Lagna:\n\n`;
  pred += `${ascSign} Lagna governs the ${signInfo.body || 'physical body'}. `;
  pred += 'Overall vitality is seen from the 1st house, longevity from the 8th, and disease from the 6th. ';
  const p = planets;
  if (p.saturn && [1,6,8].includes(p.saturn.house)) pred += 'Saturn in a health-sensitive house requires disciplined lifestyle, regular routine, and avoidance of cold or damp environments. ';
  if (p.mars && [6,8].includes(p.mars.house)) pred += 'Mars in the 6th or 8th requires care around accidents, inflammatory conditions, and surgery — preventive care is the best medicine. ';
  if (p.jupiter && [1,4,7,10].includes(p.jupiter.house)) pred += 'Jupiter in a kendra provides constitutional strength and generally good recovery from illness through optimistic attitude. ';
  pred += '\n\nWith proper lifestyle aligned to your Lagna\'s constitutional nature, robust health is entirely achievable throughout life.';
  return pred;
}

function buildSpiritualPath(planets, asc, ascSign) {
  const p = planets;
  let pred = `Spiritual Path for ${ascSign} Lagna:\n\n`;
  pred += 'The 9th house of dharma, the 12th of liberation, and the positions of Jupiter and Ketu reveal the spiritual nature. ';
  if (p.ketu && [1,5,9,12].includes(p.ketu.house)) pred += 'Ketu in a dharmic or moksha house indicates strong past life spiritual merit — meditation, mantra, and inner work come naturally. ';
  if (p.jupiter && [9,12].includes(p.jupiter.house)) pred += 'Jupiter in the 9th or 12th creates deep dharmic wisdom and potential for spiritual teaching or retreat. ';
  pred += '\n\nYour spiritual path is uniquely yours — the stars indicate the direction, but the walking is yours alone. Regular mantra practice, charitable giving, and service to those in need are universally recommended by all classical Jyotish texts.';
  return pred;
}

function buildRemedies(planets, asc, yogas) {
  const p = planets;
  const remedies = [];
  if (p.saturn && ['Aries','Cancer'].includes(p.saturn.sign)) remedies.push({ planet:'Saturn', issue:'Debilitation/Challenging placement', remedy:'Recite Shani Chalisa on Saturdays. Light mustard oil lamp. Donate black sesame seeds, iron, and black cloth on Saturdays. Wear Blue Sapphire only after proper astrological consultation.' });
  if (p.mars && [1,4,7,8,12].includes(p.mars.house)) remedies.push({ planet:'Mars (Mangal Dosha)', issue:'Mangal Dosha in chart', remedy:'Visit Mangal temple on Tuesdays. Recite Hanuman Chalisa daily. Donate red lentils and jaggery on Tuesdays. Red Coral gemstone (after consultation) strengthens Mars positively.' });
  if (p.sun && ['Libra'].includes(p.sun.sign)) remedies.push({ planet:'Sun', issue:'Debilitation', remedy:'Surya Namaskar at dawn facing East. Recite Aditya Hridayam. Donate wheat and jaggery on Sundays. Ruby gemstone (after consultation).' });
  if (p.moon && ['Scorpio'].includes(p.moon.sign)) remedies.push({ planet:'Moon', issue:'Debilitation/Challenging position', remedy:'Recite Om Chandraya Namah 108 times on Mondays. Fast on Mondays. Donate rice and white cloth. Pearl or moonstone (after consultation) is supportive.' });
  const hasKalaSarpa = yogas.find(y => y.name === 'Kala Sarpa Dosha');
  if (hasKalaSarpa) remedies.push({ planet:'Rahu-Ketu (Kala Sarpa)', issue:'Kala Sarpa Dosha', remedy:'Visit Trimbakeshwar, Kukke Subramanya, or Kalahasti for Kala Sarpa puja. Recite Rahu and Ketu beej mantras. Donate on Saturdays. This dosha, when resolved, becomes a powerful catalyst for liberation.' });
  // Universal remedies
  remedies.push({ planet:'Universal', issue:'General wellbeing and protection', remedy:'Daily Hanuman Chalisa recitation protects from all malefic influences. Giving food to the hungry on your birth weekday is universally prescribed by all classical texts. Performing Jala Abhisheka to Lord Shiva on Mondays purifies planetary doshas.' });
  return remedies;
}

function buildLifeSummary(planets, asc, ascSign, dasha, yogas, name) {
  const beneficYogas = yogas.filter(y => y.type !== 'Dosha/Caution');
  const doshas       = yogas.filter(y => y.type === 'Dosha/Caution');
  let summary = `Dear ${name},\n\n`;
  summary += `Your Vedic birth chart reveals a cosmic blueprint of extraordinary potential. Born under ${ascSign} Lagna, you carry the dharmic qualities of this sign into every area of your life.\n\n`;
  if (beneficYogas.length > 0) {
    summary += `Your chart contains ${beneficYogas.length} significant yoga${beneficYogas.length > 1 ? 's' : ''}: `;
    summary += beneficYogas.map(y => y.name).join(', ');
    summary += `. These planetary combinations, recognized by Brihat Parashara Hora Shastra and Jataka Parijata, confirm that your birth carries cosmic blessings in its very design.\n\n`;
  }
  if (doshas.length > 0) {
    summary += `The doshas in your chart — ${doshas.map(y => y.name).join(', ')} — are not curses but karmic opportunities. Every classical text confirms: a dosha with its proper remedy transforms from an obstacle into a stepping stone. The very challenges you face are the forge in which your greatest strengths are being created.\n\n`;
  }
  if (dasha) {
    summary += `You are currently in the ${dasha.planet} Mahadasha, a ${getDashaInterpretation(dasha.planet, {}).split('.')[0]} period. This cosmic season shapes your immediate path.\n\n`;
  }
  summary += `The stars do not compel — they incline. Your free will, guided by self-knowledge and righteous action (dharma), is the ultimate architect of your destiny. May this reading serve as a lantern on your path, illuminating what is already within you.\n\nWith cosmic blessings,\nNakshatra AI — Vedic Jyotish`;
  return summary;
}

module.exports = router;
