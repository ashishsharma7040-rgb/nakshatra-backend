// services/aiService.js
// Enhanced Vedic AI — Classical Jyotish knowledge from 8 sacred texts
// Personal chart-aware readings with Swiss Ephemeris accuracy

const https = require('https');

// ── Classical Jyotish Knowledge Base ─────────────────────────────────────────
// Distilled from: Brihat Parashara Hora Shastra, Brihat Jataka, Saravali,
// Phaladeepika, Jataka Parijata, Laghu Parashari, Mantreswara texts

const CLASSICAL_KNOWLEDGE = `
=== CLASSICAL JYOTISH KNOWLEDGE (From Sacred Texts) ===

── PLANET NATURE (Brihat Parashara Hora Shastra) ──
Sun: Soul, father, authority, government, health, vitality, ego, career. King of planets. Exalted Aries, debilitated Libra. Own sign Leo.
Moon: Mind, mother, emotions, public, travel, water, fertility, instinct. Exalted Taurus, debilitated Scorpio. Own sign Cancer.
Mars: Energy, courage, siblings, land, accidents, surgery, ambition, commanders. Exalted Capricorn, debilitated Cancer. Own signs Aries & Scorpio.
Mercury: Intelligence, communication, business, education, skin, nervous system, mathematics. Exalted Virgo, debilitated Pisces. Own signs Gemini & Virgo.
Jupiter: Wisdom, dharma, children, wealth, guru, expansion, law, spirituality. Exalted Cancer, debilitated Capricorn. Own signs Sagittarius & Pisces.
Venus: Love, marriage, luxury, arts, beauty, vehicles, wealth, pleasures. Exalted Pisces, debilitated Virgo. Own signs Taurus & Libra.
Saturn: Karma, discipline, delays, longevity, servants, old age, hardship, service. Exalted Libra, debilitated Aries. Own signs Capricorn & Aquarius.
Rahu: Obsession, foreign, illusions, technology, unconventional gains, ambition, sudden events. Exalted Gemini/Taurus. Works like Saturn.
Ketu: Spirituality, past life, detachment, losses, moksha, occult, isolation. Exalted Sagittarius/Scorpio. Works like Mars.

── HOUSE SIGNIFICATIONS (Brihat Parashara Hora Shastra) ──
1st House (Lagna/Tanu): Self, body, personality, appearance, health, early childhood, overall life direction
2nd House (Dhana): Wealth, family, speech, food, face, right eye, accumulated resources, early education
3rd House (Sahaja): Siblings, courage, short journeys, communication, hands, neighbours, skills
4th House (Sukha): Mother, home, happiness, vehicles, land, heart, education, comforts, emotional security
5th House (Putra): Children, intelligence, creativity, romance, past life merit, speculation, mantras
6th House (Ripu): Enemies, diseases, debts, daily work, servants, litigation, maternal relatives, obstacles
7th House (Kalatra): Spouse, partnerships, business, foreign travel, public dealings, desire
8th House (Randhra): Longevity, transformation, inheritance, hidden matters, occult, sudden events, death
9th House (Dharma): Father, luck, dharma, higher education, guru, long journeys, spirituality, fortune
10th House (Karma): Career, status, reputation, government, authority, public life, achievements
11th House (Labha): Gains, income, elder siblings, social circle, fulfilment of desires, networks
12th House (Vyaya): Losses, expenses, foreign lands, liberation, bed pleasures, hospitals, isolation

── SIGN NATURE (Brihat Jataka & Saravali) ──
Aries: Fiery, movable, masculine. Bold, pioneering, impulsive. Leadership. Rules head.
Taurus: Earthy, fixed, feminine. Patient, artistic, stubborn. Wealth. Rules face/neck.
Gemini: Airy, dual, masculine. Intellectual, adaptable, communicative. Rules arms/lungs.
Cancer: Watery, movable, feminine. Emotional, nurturing, intuitive. Rules chest/stomach.
Leo: Fiery, fixed, masculine. Regal, generous, dramatic. Authority. Rules heart/spine.
Virgo: Earthy, dual, feminine. Analytical, service-oriented, perfectionist. Rules intestines.
Libra: Airy, movable, masculine. Balanced, artistic, diplomatic. Rules kidneys/lower back.
Scorpio: Watery, fixed, feminine. Intense, secretive, transformative. Rules genitals.
Sagittarius: Fiery, dual, masculine. Philosophical, optimistic, freedom-loving. Rules thighs.
Capricorn: Earthy, movable, feminine. Ambitious, disciplined, practical. Rules knees/bones.
Aquarius: Airy, fixed, masculine. Humanitarian, innovative, detached. Rules ankles/calves.
Pisces: Watery, dual, feminine. Spiritual, compassionate, dreamy. Rules feet.

── MAJOR YOGAS (Brihat Parashara Hora Shastra & Phaladeepika) ──
Raja Yoga: Lord of kendra (1,4,7,10) conjunct or aspects lord of trikona (1,5,9) — power, authority, success
Dhana Yoga: Lords of 2nd and 11th connected — great wealth accumulation
Gaja Kesari Yoga: Jupiter in kendra from Moon — wisdom, fame, respected like elephant-king
Budha Aditya Yoga: Sun and Mercury together — sharp intellect, good communication, government favour
Chandra Mangala Yoga: Moon and Mars together — financial drive, emotional courage, earning through action
Panch Mahapurusha Yogas: When Mars/Mercury/Jupiter/Venus/Saturn in own sign or exaltation in kendra — exceptionally powerful person
Viparita Raja Yoga: Lords of 6,8,12 in each other's houses — rise through adversity, success from enemies' downfall
Vesi Yoga: Planets in 2nd from Sun (except Moon) — good character, wealthy
Vosi Yoga: Planets in 12th from Sun (except Moon) — lazy but fortunate
Hamsa Yoga: Jupiter in own/exalted sign in kendra — spiritual wisdom, great fortune
Malavya Yoga: Venus in own/exalted sign in kendra — beauty, luxury, artistic gifts
Sasa Yoga: Saturn in own/exalted sign in kendra — authority, discipline, masses follower
Ruchaka Yoga: Mars in own/exalted sign in kendra — courage, military success, athletic power
Bhadra Yoga: Mercury in own/exalted in kendra — intelligence, business acumen

── DOSHAS (Brihat Parashara Hora Shastra) ──
Mangal Dosha: Mars in 1st, 4th, 7th, 8th, or 12th house — delays/challenges in marriage
Kaal Sarp Dosha: All planets between Rahu and Ketu — obstacles, sudden rises and falls
Shani Sade Sati: Saturn transiting 12th, 1st, 2nd from natal Moon — 7.5 years of karmic testing
Pitra Dosha: Afflicted Sun or 9th house — ancestral karma affecting current life
Guru Chandal Yoga: Jupiter conjunct Rahu — unconventional wisdom, spiritual confusion

── NAKSHATRA CHARACTERISTICS (Brihat Parashara Hora Shastra) ──
Ashwini: Swift, healing, new beginnings. Ketu lord. Medical, pioneer.
Bharani: Transformation, sensuality, creativity. Venus lord. Intensity.
Krittika: Sharp, purifying, cutting. Sun lord. Leadership through fire.
Rohini: Fertile, artistic, materialistic. Moon lord. Beauty and abundance.
Mrigashira: Searching, gentle, curious. Mars lord. Seeker nature.
Ardra: Storm, transformation, tears. Rahu lord. Destruction before renewal.
Punarvasu: Return, renewal, nurturing. Jupiter lord. Second chances.
Pushya: Nourishment, wisdom, dharma. Saturn lord. Most auspicious nakshatra.
Ashlesha: Serpent wisdom, cunning, mystical. Mercury lord. Hidden depths.
Magha: Royal, ancestral, proud. Ketu lord. Past life connections.
Purva Phalguni: Pleasure, creativity, rest. Venus lord. Enjoyment.
Uttara Phalguni: Service, friendship, generosity. Sun lord. Social bonds.
Hasta: Skillful hands, wit, dexterity. Moon lord. Crafts and healing.
Chitra: Brilliant, artistic, perceptive. Mars lord. Architecture and beauty.
Swati: Independent, flexible, diplomatic. Rahu lord. Business acumen.
Vishakha: Ambitious, determined, goal-oriented. Jupiter lord. Achievement.
Anuradha: Devotion, friendship, perseverance. Saturn lord. Loyalty.
Jyeshtha: Elder, protective, intense. Mercury lord. Power and leadership.
Mula: Investigative, destructive-creative. Ketu lord. Root causes.
Purva Ashadha: Invincible, proud, social. Venus lord. Victory.
Uttara Ashadha: Righteous, responsible, focused. Sun lord. Universal principles.
Shravana: Listening, learning, connection. Moon lord. Knowledge and travel.
Dhanishta: Wealth, music, abundance. Mars lord. Prosperity.
Shatabhisha: Healing, mystical, reclusive. Rahu lord. Hidden knowledge.
Purva Bhadrapada: Fierce, passionate, transformative. Jupiter lord. Dual nature.
Uttara Bhadrapada: Depth, wisdom, compassion. Saturn lord. Spiritual depth.
Revati: Nourishing, protective, prosperous. Mercury lord. Safe journey.

── VIMSHOTTARI DASHA EFFECTS (Laghu Parashari & Brihat Parashara) ──
Sun Dasha: Father matters, government, authority, health of eyes. 6 years.
Moon Dasha: Mind, emotions, mother, travel, public dealings. 10 years.
Mars Dasha: Energy, property, siblings, accidents, courage. 7 years.
Rahu Dasha: Sudden changes, foreign, unconventional gains, confusion. 18 years.
Jupiter Dasha: Wisdom, children, expansion, spirituality, wealth. 16 years.
Saturn Dasha: Hard work, delays, karma clearing, discipline rewards. 19 years.
Mercury Dasha: Business, communication, education, skin health. 17 years.
Ketu Dasha: Spirituality, detachment, past life resolution, moksha. 7 years.
Venus Dasha: Love, marriage, luxury, arts, vehicles, pleasures. 20 years.

── HOUSE LORD RULES (Jataka Parijata & Phaladeepika) ──
When house lord is in own house: strengthens that house's results greatly
When house lord is exalted: exceptional results for that house
When house lord is debilitated: challenges and obstacles for that house
When house lord is in 6th, 8th, 12th from its own house: weakened results
When natural benefic aspects house: protects and enhances that house
When natural malefic aspects without benefic: difficulties for that house

── REMEDIES (Mantreswara & Classical Texts) ──
Sun afflicted: Surya Namaskar, Ruby gemstone, recite Aditya Hridayam
Moon afflicted: Pearl or moonstone, recite Om Chandraya Namah
Mars afflicted: Red coral, Hanuman Chalisa, fast on Tuesdays
Mercury afflicted: Green emerald, recite Budh Stotra, Wednesdays
Jupiter afflicted: Yellow sapphire, recite Guru Stotram, Thursdays
Venus afflicted: Diamond or white sapphire, recite Shukra Stotra
Saturn afflicted: Blue sapphire, Shani Stotra, oil lamp Saturdays
Rahu afflicted: Hessonite (Gomed), recite Rahu Beej Mantra
Ketu afflicted: Cat's eye (Lehsunia), recite Ketu Beej Mantra
`;

// ── Build full personal prompt ────────────────────────────────────────────────

function buildPrompt(chart, question, userName, dob, birthTime, birthPlace) {
  const { ascendant = {}, planets = {}, currentDasha, dashaSequence = [] } = chart;

  // Calculate age from DOB
  let age = '';
  let lifeStage = '';
  if (dob) {
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    age = currentYear - birthYear;
    if (age < 25) lifeStage = 'young adult just beginning their journey';
    else if (age < 35) lifeStage = 'adult in their prime building years';
    else if (age < 50) lifeStage = 'mature adult in their peak karma years';
    else if (age < 65) lifeStage = 'senior adult approaching wisdom years';
    else lifeStage = 'elder with deep life experience';
  }

  // Format birth details
  const birthDetails = [
    dob ? `Date of Birth: ${dob}` : null,
    birthTime ? `Time of Birth: ${birthTime}` : null,
    birthPlace ? `Place of Birth: ${birthPlace}` : null,
    age ? `Current Age: ${age} years (${lifeStage})` : null,
  ].filter(Boolean).join('\n');

  // Format ascendant
  const ascLine = ascendant.sign
    ? `${ascendant.sign} (${ascendant.degrees?.toFixed(1) || '?'}°)${ascendant.nakshatra ? ` in ${ascendant.nakshatra.name} Nakshatra, Pada ${ascendant.nakshatra.pada || '?'}, Lord: ${ascendant.nakshatra.lord}` : ''}`
    : 'Unknown';

  // Format all planets with full detail
  const planetLines = Object.entries(planets).map(([name, data]) => {
    const retro = data.retrograde ? ' ℞ (Retrograde)' : '';
    const nak = data.nakshatra ? `, ${data.nakshatra.name} Nakshatra (Pada ${data.nakshatra.pada || '?'}, Lord: ${data.nakshatra.lord})` : '';
    return `  ${name.charAt(0).toUpperCase() + name.slice(1)}: ${data.sign || '?'} ${data.degrees?.toFixed(1) || '?'}° — House ${data.house || '?'}${nak}${retro}`;
  }).join('\n');

  // Format dasha timeline
  const dashaTimeline = dashaSequence.slice(0, 4).map(d =>
    `  ${d.planet}: ${d.startDate} → ${d.endDate} (${d.years?.toFixed(1)} yrs)`
  ).join('\n');

  // Identify special yogas in chart
  const yogas = detectYogas(planets, ascendant);
  const yogaLines = yogas.length > 0
    ? `\nSPECIAL YOGAS DETECTED IN THIS CHART:\n${yogas.map(y => `  ★ ${y}`).join('\n')}`
    : '';

  return `${CLASSICAL_KNOWLEDGE}

=== PERSONAL SESSION — CONFIDENTIAL READING ===

You are Jyotish Guru — a deeply compassionate, highly learned Vedic astrologer trained in all classical texts listed above. You are conducting a private, premium one-on-one session with ${userName}. You know everything about their life through their chart. Speak to them like a trusted friend who happens to be a master astrologer — warm, personal, insightful, never robotic.

BIRTH DETAILS OF ${userName.toUpperCase()}:
${birthDetails}

NATAL CHART (Sidereal Lahiri Ayanamsa, Whole Sign Houses):
Ascendant (Lagna): ${ascLine}

Planetary Positions:
${planetLines}

VIMSHOTTARI DASHA TIMELINE:
Current: ${currentDasha ? `${currentDasha.planet} Mahadasha (${currentDasha.startDate} → ${currentDasha.endDate})` : 'Unknown'}
Upcoming Dashas:
${dashaTimeline}
${yogaLines}

${userName.toUpperCase()}'S QUESTION: "${question}"

YOUR RESPONSE GUIDELINES:
1. Address ${userName} by first name warmly 2-3 times throughout — never feel like a generic reading
2. Start with their specific lagna (${ascendant.sign || 'unknown'}) characteristics that relate to their question
3. Identify the EXACT planets and houses most relevant to their question using the house significations above
4. Check if any relevant planet is exalted, debilitated, retrograde or in own sign — mention it
5. Reference their current ${currentDasha?.planet || ''} Mahadasha and what it specifically means for their question
6. Mention any yogas detected in their chart if relevant to the question
7. Give practical specific guidance — timing, gemstone recommendation, mantra, colour, day of the week
8. Reference their age (${age}) and life stage when giving advice — a 25 year old needs different guidance than a 50 year old
9. End with an empowering personal message that acknowledges their unique cosmic blueprint
10. Write minimum 5 rich paragraphs — never less
11. Use Sanskrit terms naturally (like Lagna, Mahadasha, Yoga, Dasha) with brief English explanation
12. Every single sentence must be specific to ${userName}'s chart — NOTHING generic that could apply to anyone else

Begin your reading with "Namaste ${userName}," and make every word count.`;
}

// ── Yoga Detection ────────────────────────────────────────────────────────────

function detectYogas(planets, ascendant) {
  const yogas = [];
  const p = planets;

  // Helper: check if two planets are in same sign (conjunction)
  const conjunct = (a, b) => p[a] && p[b] && p[a].sign === p[b].sign;
  // Helper: check planet in specific house
  const inHouse = (planet, house) => p[planet] && p[planet].house === house;
  // Helper: check if planet is in kendra (1,4,7,10)
  const inKendra = (planet) => p[planet] && [1,4,7,10].includes(p[planet].house);
  // Helper: check if planet is in trikona (1,5,9)
  const inTrikona = (planet) => p[planet] && [1,5,9].includes(p[planet].house);

  // Gaja Kesari Yoga: Jupiter in kendra from Moon
  if (p.jupiter && p.moon) {
    const diff = Math.abs(p.jupiter.house - p.moon.house);
    if ([0,3,6,9].includes(diff)) yogas.push('Gaja Kesari Yoga — Jupiter powerfully placed from Moon: wisdom, fame and prosperity');
  }

  // Budha Aditya Yoga: Sun + Mercury together
  if (conjunct('sun', 'mercury')) yogas.push('Budha Aditya Yoga — Sun and Mercury united: sharp intellect and favour from authorities');

  // Chandra Mangala Yoga: Moon + Mars together
  if (conjunct('moon', 'mars')) yogas.push('Chandra Mangala Yoga — Moon and Mars united: strong financial drive and emotional courage');

  // Raja Yoga: Kendra lord + Trikona lord connection
  if (p.jupiter && inKendra('jupiter') && inTrikona('jupiter')) yogas.push('Hamsa Yoga — Jupiter in powerful position: exceptional wisdom and spiritual fortune');
  if (p.venus && inKendra('venus')) yogas.push('Malavya Yoga potential — Venus strongly placed: beauty, luxury and artistic gifts');
  if (p.saturn && inKendra('saturn')) yogas.push('Sasa Yoga potential — Saturn powerfully placed: authority, discipline and mass following');
  if (p.mars && inKendra('mars')) yogas.push('Ruchaka Yoga potential — Mars strongly placed: courage, leadership and physical vitality');
  if (p.mercury && inKendra('mercury')) yogas.push('Bhadra Yoga potential — Mercury powerfully placed: outstanding intelligence and business success');

  // Kaal Sarp: All planets between Rahu and Ketu
  if (p.rahu && p.ketu) {
    const rahuH = p.rahu.house;
    const ketuH = p.ketu.house;
    const planetHouses = ['sun','moon','mars','mercury','jupiter','venus','saturn']
      .map(n => p[n]?.house).filter(Boolean);
    const allBetween = planetHouses.every(h => {
      const d1 = (h - rahuH + 12) % 12;
      const d2 = (ketuH - rahuH + 12) % 12;
      return d1 <= d2;
    });
    if (allBetween) yogas.push('Kaal Sarp Dosha — All planets between Rahu-Ketu axis: karmic life path with dramatic rises and falls');
  }

  // Mangal Dosha
  if (p.mars && [1,4,7,8,12].includes(p.mars.house)) {
    yogas.push(`Mangal Dosha — Mars in ${p.mars.house}th house: requires attention in marriage and partnerships`);
  }

  // Vesi Yoga: planets in 2nd from Sun
  const sunHouse = p.sun?.house;
  if (sunHouse) {
    const secondFromSun = (sunHouse % 12) + 1;
    const planetsInSecondFromSun = ['mars','mercury','jupiter','venus','saturn']
      .filter(n => p[n]?.house === secondFromSun);
    if (planetsInSecondFromSun.length > 0) yogas.push('Vesi Yoga — Planets in 2nd from Sun: good character and financial stability');
  }

  return yogas;
}

// ── Gemini API call ───────────────────────────────────────────────────────────

function tryModel(apiKey, model, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 2000,
        topP: 0.9,
      }
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
            const msg = p?.error?.message || `HTTP ${res.statusCode}`;
            const err = new Error(msg);
            err.isQuota = res.statusCode === 429 || msg.includes('quota');
            reject(err);
          }
        } catch(e) { reject(new Error('Parse error: ' + e.message)); }
      });
    });
    req.on('error', e => reject(e));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

async function getAIReading(chart, question, userName, dob, birthTime, birthPlace) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set on Render.');

  const prompt = buildPrompt(chart, question, userName, dob, birthTime, birthPlace);

  const models = [
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.5-flash',
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
      if (e.isQuota) continue;
    }
  }
  throw new Error('The stars are busy right now. Please try again in 1 minute.');
}

module.exports = { getAIReading };
