// services/ephemerisService.js
// Calculates Vedic (Sidereal/Lahiri) birth chart.
// Uses swisseph if installed, otherwise a simplified fallback.

let swisseph;
try {
  swisseph = require('swisseph');
} catch (e) {
  console.warn('swisseph not installed — using fallback calculator');
  swisseph = null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

const NAKSHATRAS = [
  { name:'Ashwini',     lord:'Ketu'    },
  { name:'Bharani',     lord:'Venus'   },
  { name:'Krittika',    lord:'Sun'     },
  { name:'Rohini',      lord:'Moon'    },
  { name:'Mrigashira',  lord:'Mars'    },
  { name:'Ardra',       lord:'Rahu'    },
  { name:'Punarvasu',   lord:'Jupiter' },
  { name:'Pushya',      lord:'Saturn'  },
  { name:'Ashlesha',    lord:'Mercury' },
  { name:'Magha',       lord:'Ketu'    },
  { name:'Purva Phalguni',  lord:'Venus'   },
  { name:'Uttara Phalguni', lord:'Sun'     },
  { name:'Hasta',       lord:'Moon'    },
  { name:'Chitra',      lord:'Mars'    },
  { name:'Swati',       lord:'Rahu'    },
  { name:'Vishakha',    lord:'Jupiter' },
  { name:'Anuradha',    lord:'Saturn'  },
  { name:'Jyeshtha',    lord:'Mercury' },
  { name:'Mula',        lord:'Ketu'    },
  { name:'Purva Ashadha',   lord:'Venus'   },
  { name:'Uttara Ashadha',  lord:'Sun'     },
  { name:'Shravana',    lord:'Moon'    },
  { name:'Dhanishta',   lord:'Mars'    },
  { name:'Shatabhisha', lord:'Rahu'    },
  { name:'Purva Bhadrapada',  lord:'Jupiter' },
  { name:'Uttara Bhadrapada', lord:'Saturn'  },
  { name:'Revati',      lord:'Mercury' },
];

const DASHA_YEARS = {
  Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7,
  Rahu:18, Jupiter:16, Saturn:19, Mercury:17,
};

const DASHA_SEQUENCE = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toJulianDay(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min]        = timeStr.split(':').map(Number);
  const ut = hour + min / 60;
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + ut / 24 + B - 1524.5;
}

function toSidereal(tropicalDeg, ayanamsa) {
  let sid = tropicalDeg - ayanamsa;
  while (sid < 0)    sid += 360;
  while (sid >= 360) sid -= 360;
  return sid;
}

function lonToSign(lon) {
  const signIndex = Math.floor(lon / 30);
  const degrees   = lon % 30;
  return {
    sign:      SIGNS[signIndex],
    signIndex,
    degrees:   parseFloat(degrees.toFixed(4)),
    formatted: `${SIGNS[signIndex]} ${degrees.toFixed(2)}°`,
  };
}

function lonToNakshatra(lon) {
  const nakIndex = Math.floor(lon / (360 / 27));
  const nakDeg   = lon % (360 / 27);
  const pada     = Math.floor(nakDeg / (360 / 108)) + 1;
  const nak      = NAKSHATRAS[nakIndex % 27];
  return { name: nak.name, lord: nak.lord, pada };
}

function calcHouse(planetSignIndex, ascSignIndex) {
  return ((planetSignIndex - ascSignIndex + 12) % 12) + 1;
}

function addYears(date, years) {
  const d = new Date(date);
  const whole = Math.floor(years);
  const frac  = years - whole;
  d.setFullYear(d.getFullYear() + whole);
  d.setDate(d.getDate() + Math.round(frac * 365.25));
  return d;
}

function calcDashas(moonLon, dobDateStr, dobTimeStr) {
  const moonNak     = lonToNakshatra(moonLon);
  const nakLord     = moonNak.lord;
  const nakStartIdx = DASHA_SEQUENCE.indexOf(nakLord);
  const nakSpan     = 360 / 27;
  const posInNak    = moonLon % nakSpan;
  const fracElapsed = posInNak / nakSpan;
  const firstYears  = DASHA_YEARS[nakLord] * (1 - fracElapsed);

  const [yr, mo, dy] = dobDateStr.split('-').map(Number);
  const [hr, mn]     = dobTimeStr.split(':').map(Number);
  let cursor = new Date(yr, mo - 1, dy, hr, mn);

  const dashaSequence = [];
  for (let i = 0; i < 9; i++) {
    const idx    = (nakStartIdx + i) % 9;
    const planet = DASHA_SEQUENCE[idx];
    const years  = i === 0 ? firstYears : DASHA_YEARS[planet];
    const start  = new Date(cursor);
    cursor = addYears(cursor, years);
    dashaSequence.push({
      planet,
      years:     parseFloat(years.toFixed(2)),
      startDate: start.toISOString().split('T')[0],
      endDate:   cursor.toISOString().split('T')[0],
    });
  }

  const now = new Date();
  const currentDasha = dashaSequence.find(d =>
    new Date(d.startDate) <= now && now < new Date(d.endDate)
  ) || dashaSequence[0];

  return { dashaSequence, currentDasha };
}

// ── Main export ───────────────────────────────────────────────────────────────
async function calculateChart({ dob, time, latitude, longitude }) {
  if (swisseph) {
    return calculateWithSwissEph({ dob, time, latitude, longitude });
  }
  return calculateFallback({ dob, time, latitude, longitude });
}

// ── Swiss Ephemeris (production) ──────────────────────────────────────────────
function calculateWithSwissEph({ dob, time, latitude, longitude }) {
  return new Promise((resolve, reject) => {
    try {
      const jd = toJulianDay(dob, time);
      swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0);
      const ayanamsa = swisseph.swe_get_ayanamsa_ut(jd);
      const FLAG     = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED;

      const PLANET_IDS = {
        sun:     swisseph.SE_SUN,
        moon:    swisseph.SE_MOON,
        mercury: swisseph.SE_MERCURY,
        venus:   swisseph.SE_VENUS,
        mars:    swisseph.SE_MARS,
        jupiter: swisseph.SE_JUPITER,
        saturn:  swisseph.SE_SATURN,
        rahu:    swisseph.SE_MEAN_NODE,
      };

      const rawPlanets = {};
      for (const [name, id] of Object.entries(PLANET_IDS)) {
        const result = swisseph.swe_calc_ut(jd, id, FLAG);
        if (result.rflag < 0) throw new Error(`swisseph error for ${name}: ${result.serr}`);
        rawPlanets[name] = result.longitude;
      }
      rawPlanets.ketu = (rawPlanets.rahu + 180) % 360;

      const siderealPlanets = {};
      for (const [name, lon] of Object.entries(rawPlanets)) {
        siderealPlanets[name] = toSidereal(lon, ayanamsa);
      }

      // Whole Sign Ascendant
      const houseResult = swisseph.swe_houses(jd, latitude, longitude, 'W');
      const ascSidereal = toSidereal(houseResult.ascendant, ayanamsa);
      const ascData     = lonToSign(ascSidereal);

      const planets = {};
      for (const [name, sidLon] of Object.entries(siderealPlanets)) {
        const signData = lonToSign(sidLon);
        planets[name]  = {
          ...signData,
          house:     calcHouse(signData.signIndex, ascData.signIndex),
          nakshatra: lonToNakshatra(sidLon),
          longitude: parseFloat(sidLon.toFixed(6)),
        };
      }

      const { dashaSequence, currentDasha } = calcDashas(siderealPlanets.moon, dob, time);

      resolve({
        ascendant: {
          ...ascData,
          nakshatra: lonToNakshatra(ascSidereal),
          longitude: parseFloat(ascSidereal.toFixed(6)),
        },
        planets,
        dashaSequence,
        currentDasha,
        calculatedAt: new Date().toISOString(),
        method: 'swisseph-lahiri',
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Fallback (when swisseph not available) ────────────────────────────────────
function calculateFallback({ dob, time, latitude, longitude }) {
  const jd = toJulianDay(dob, time);
  const T  = (jd - 2451545.0) / 36525;

  const tropicalLons = {
    sun:     (280.46646 + 36000.76983 * T) % 360,
    moon:    (218.3165  + 481267.8813 * T) % 360,
    mercury: (252.2509  + 149472.6674 * T) % 360,
    venus:   (181.9798  + 58517.8156  * T) % 360,
    mars:    (355.4330  + 19140.2993  * T) % 360,
    jupiter: (34.3515   + 3034.9057   * T) % 360,
    saturn:  (50.0774   + 1222.1138   * T) % 360,
    rahu:    (125.0445  - 1934.1362   * T) % 360,
  };

  for (const k of Object.keys(tropicalLons)) {
    while (tropicalLons[k] < 0) tropicalLons[k] += 360;
  }
  tropicalLons.ketu = (tropicalLons.rahu + 180) % 360;

  // Approximate ascendant
  const lstDeg = (100.4606 + 36000.7700 * T + longitude) % 360;
  const obliq  = 23.4393 - 0.0130 * T;
  const lstRad = lstDeg * Math.PI / 180;
  const oblRad = obliq  * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const ascTropical = (
    Math.atan2(Math.cos(lstRad), -(Math.sin(lstRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad)))
    * 180 / Math.PI + 360
  ) % 360;

  const ayanamsa = 23.85 + 0.000136 * (jd - 2415020.0) / 365.25;

  const siderealLons = {};
  for (const [k, v] of Object.entries(tropicalLons)) {
    siderealLons[k] = toSidereal(v, ayanamsa);
  }
  const ascSidereal = toSidereal(ascTropical, ayanamsa);
  const ascData     = lonToSign(ascSidereal);

  const planets = {};
  for (const [name, lon] of Object.entries(siderealLons)) {
    const signData = lonToSign(lon);
    planets[name]  = {
      ...signData,
      house:     calcHouse(signData.signIndex, ascData.signIndex),
      nakshatra: lonToNakshatra(lon),
      longitude: parseFloat(lon.toFixed(6)),
    };
  }

  const { dashaSequence, currentDasha } = calcDashas(siderealLons.moon, dob, time);

  return {
    ascendant: {
      ...ascData,
      nakshatra: lonToNakshatra(ascSidereal),
      longitude: parseFloat(ascSidereal.toFixed(6)),
    },
    planets,
    dashaSequence,
    currentDasha,
    calculatedAt: new Date().toISOString(),
    method: 'fallback-simplified',
  };
}

module.exports = { calculateChart };
