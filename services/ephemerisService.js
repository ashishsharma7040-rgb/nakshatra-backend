/**
 * ╔═══════════════════════════════════════╗
 * ║   EPHEMERIS SERVICE                   ║
 * ║   Wraps Swiss Ephemeris calculations  ║
 * ║   Calculates planets, houses, dashas  ║
 * ╚═══════════════════════════════════════╝
 *
 * Swiss Ephemeris is an astronomical engine — NOT an AI.
 * It takes birth time + coordinates → returns exact planet positions.
 *
 * Input:  { dob, time, latitude, longitude }
 * Output: { ascendant, planets, houses, nakshatras, dashas }
 */

// NOTE: In production install swisseph via: npm install swisseph
// For development/testing we use a fallback mock so the server runs
// without requiring the native C library to be compiled.
let swisseph;
try {
  swisseph = require('swisseph');
} catch (e) {
  swisseph = null;
  console.warn('⚠️  swisseph not installed — using mock data for development.');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLANET_IDS = {
  SUN:     0,
  MOON:    1,
  MERCURY: 2,
  VENUS:   3,
  MARS:    4,
  JUPITER: 5,
  SATURN:  6,
  RAHU:    11, // Mean Node (North Node)
  KETU:    11, // Calculated as Rahu + 180°
};

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha',
  'Purva Bhadrapada','Uttara Bhadrapada','Revati'
];

// Vimshottari Dasha sequence and durations (years)
const DASHA_SEQUENCE = [
  { planet: 'Ketu',    years: 7  },
  { planet: 'Venus',   years: 20 },
  { planet: 'Sun',     years: 6  },
  { planet: 'Moon',    years: 10 },
  { planet: 'Mars',    years: 7  },
  { planet: 'Rahu',    years: 18 },
  { planet: 'Jupiter', years: 16 },
  { planet: 'Saturn',  years: 19 },
  { planet: 'Mercury', years: 17 },
];

// ── Utility helpers ────────────────────────────────────────────────────────────

/**
 * Convert a calendar date + time string to a Julian Day Number.
 * Swiss Ephemeris requires Julian Day as its time input.
 */
function toJulianDay(dob, timeStr) {
  const [year, month, day] = dob.split('-').map(Number);
  const [hour, minute]     = (timeStr || '00:00').split(':').map(Number);
  const decimalHour        = hour + minute / 60;

  if (swisseph) {
    return swisseph.swe_julday(year, month, day, decimalHour, swisseph.SE_GREG_CAL);
  }

  // Fallback: standard Julian Day formula
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045 +
    decimalHour / 24
  );
}

/**
 * Convert ecliptic longitude (0–360°) to zodiac sign + degrees.
 */
function longitudeToSign(longitude) {
  const signIndex  = Math.floor(longitude / 30);
  const degrees    = (longitude % 30).toFixed(2);
  return {
    sign:      ZODIAC_SIGNS[signIndex],
    signIndex,
    degrees:   parseFloat(degrees),
    longitude: parseFloat(longitude.toFixed(4)),
  };
}

/**
 * Get nakshatra (lunar mansion) from Moon's longitude.
 * Each nakshatra spans 13°20' (13.333°).
 */
function getNakshatra(longitude) {
  const index = Math.floor(longitude / (360 / 27));
  const pada  = Math.floor((longitude % (360 / 27)) / (360 / 108)) + 1;
  return {
    name: NAKSHATRAS[index],
    pada,
    lord: getNakshatraLord(index),
  };
}

function getNakshatraLord(index) {
  const lords = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
  return lords[index % 9];
}

/**
 * Calculate Vimshottari Dasha periods based on Moon nakshatra.
 * This is one of the most important predictive tools in Vedic astrology.
 */
function calculateDashas(moonLongitude, birthDate) {
  const nakIndex  = Math.floor(moonLongitude / (360 / 27));
  const completed = (moonLongitude % (360 / 27)) / (360 / 27); // 0–1 fraction completed

  // Find which dasha the person was born into
  const lordIndex = nakIndex % 9;

  const dashas = [];
  let startDate = new Date(birthDate);

  // Subtract already-elapsed portion of first dasha
  const firstDasha   = DASHA_SEQUENCE[lordIndex];
  const elapsedYears = firstDasha.years * completed;
  startDate.setFullYear(startDate.getFullYear() - Math.floor(elapsedYears));

  // Generate 9 mahadashas
  for (let i = 0; i < 9; i++) {
    const dashaInfo = DASHA_SEQUENCE[(lordIndex + i) % 9];
    const endDate   = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + dashaInfo.years);

    dashas.push({
      planet:    dashaInfo.planet,
      years:     dashaInfo.years,
      startDate: startDate.toISOString().split('T')[0],
      endDate:   endDate.toISOString().split('T')[0],
      isCurrent: startDate <= new Date() && new Date() <= endDate,
    });

    startDate = new Date(endDate);
  }

  return dashas;
}

// ── Main planet calculation ────────────────────────────────────────────────────

function calculatePlanetPositions(julianDay) {
  const results = {};

  if (swisseph) {
    // ── Real Swiss Ephemeris calculations ──
    const flag = swisseph.SEFLG_SIDEREAL; // Vedic (sidereal) zodiac
    swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0); // Lahiri ayanamsha

    for (const [name, id] of Object.entries(PLANET_IDS)) {
      if (name === 'KETU') continue;
      const result = swisseph.swe_calc_ut(julianDay, id, flag);
      results[name.toLowerCase()] = longitudeToSign(result.longitude);
    }

    // Ketu = Rahu + 180°
    const rahuLon  = results.rahu.longitude;
    results['ketu'] = longitudeToSign((rahuLon + 180) % 360);

  } else {
    // ── Mock data for development (no native library needed) ──
    const mockLongitudes = {
      sun: 45.5, moon: 65.2, mercury: 30.8, venus: 72.3,
      mars: 130.6, jupiter: 100.4, saturn: 312.1, rahu: 150.0,
    };
    for (const [planet, lon] of Object.entries(mockLongitudes)) {
      results[planet] = longitudeToSign(lon);
    }
    results['ketu'] = longitudeToSign((mockLongitudes.rahu + 180) % 360);
  }

  return results;
}

// ── House calculation (Placidus system) ───────────────────────────────────────

function calculateHouses(julianDay, latitude, longitude) {
  if (swisseph) {
    const houses = swisseph.swe_houses(julianDay, latitude, longitude, 'P'); // 'P' = Placidus
    return {
      cusps:     houses.house,
      ascendant: longitudeToSign(houses.ascendant),
      mc:        longitudeToSign(houses.mc),
    };
  }

  // Mock house cusps
  const mockCusps = [0,182,212,242,272,302,332,2,32,62,92,122,152];
  return {
    cusps:     mockCusps,
    ascendant: longitudeToSign(182.5),
    mc:        longitudeToSign(92.3),
  };
}

// ── Assign planets to houses ───────────────────────────────────────────────────

function assignPlanetsToHouses(planets, houseCusps) {
  const housed = {};
  for (const [planet, data] of Object.entries(planets)) {
    let house = 12;
    for (let i = 0; i < 12; i++) {
      const startCusp = houseCusps[i + 1] || 0;
      const endCusp   = houseCusps[i + 2] || 360;
      if (data.longitude >= startCusp && data.longitude < endCusp) {
        house = i + 1;
        break;
      }
    }
    housed[planet] = { ...data, house };
  }
  return housed;
}

// ── Master calculation function ────────────────────────────────────────────────

/**
 * calculateBirthChart
 * -------------------
 * Takes birth details, returns the complete Vedic astrological chart.
 *
 * @param {object} params
 * @param {string} params.dob       - "YYYY-MM-DD"
 * @param {string} params.time      - "HH:MM" (24hr)
 * @param {number} params.latitude  - e.g. 19.076
 * @param {number} params.longitude - e.g. 72.877
 * @returns {object} chart
 */
function calculateBirthChart({ dob, time, latitude, longitude }) {
  const julianDay = toJulianDay(dob, time);
  const planets   = calculatePlanetPositions(julianDay);
  const houses    = calculateHouses(julianDay, latitude, longitude);
  const housedPlanets = assignPlanetsToHouses(planets, houses.cusps);
  const moonNakshatra = getNakshatra(planets.moon.longitude);
  const dashas        = calculateDashas(planets.moon.longitude, dob);
  const currentDasha  = dashas.find(d => d.isCurrent) || dashas[0];

  return {
    ascendant: {
      ...houses.ascendant,
      nakshatra: getNakshatra(houses.ascendant.longitude),
    },
    mc: houses.mc,
    planets: housedPlanets,
    moon: {
      ...housedPlanets.moon,
      nakshatra: moonNakshatra,
    },
    dashas,
    currentDasha,
    calculatedAt: new Date().toISOString(),
    ayanamsha: 'Lahiri',
    houseSystem: 'Placidus',
  };
}

module.exports = { calculateBirthChart, ZODIAC_SIGNS, NAKSHATRAS };
