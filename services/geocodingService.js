/**
 * ╔═══════════════════════════════════════╗
 * ║   GEOCODING SERVICE                   ║
 * ║   Converts "Mumbai, India"            ║
 * ║   → { latitude: 19.076, lon: 72.877 } ║
 * ╚═══════════════════════════════════════╝
 *
 * Swiss Ephemeris needs exact lat/lng — not city names.
 * This service converts the user's typed location into coordinates.
 *
 * Using OpenCage (free: 2500 requests/day)
 * Sign up: https://opencagedata.com
 */

const axios = require('axios');

// ── Cache to avoid re-geocoding the same city ──────────────────────────────────
const geocodeCache = new Map();

/**
 * geocodeLocation
 * ---------------
 * @param {string} locationName  e.g. "Mumbai, India"
 * @returns {{ latitude, longitude, formattedAddress, timezone }}
 */
async function geocodeLocation(locationName) {
  const cacheKey = locationName.toLowerCase().trim();

  // Return from cache if available
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const apiKey = process.env.OPENCAGE_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  OPENCAGE_API_KEY not set — using mock coordinates for development');
    return getMockCoordinates(locationName);
  }

  try {
    const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: locationName,
        key: apiKey,
        limit: 1,
        no_annotations: 0,
        language: 'en',
      },
      timeout: 8000,
    });

    const results = response.data.results;
    if (!results || results.length === 0) {
      throw new Error(`Location not found: "${locationName}"`);
    }

    const result = results[0];
    const data = {
      latitude:         result.geometry.lat,
      longitude:        result.geometry.lng,
      formattedAddress: result.formatted,
      timezone:         result.annotations?.timezone?.name || 'Asia/Kolkata',
    };

    // Cache it for this session
    geocodeCache.set(cacheKey, data);
    return data;

  } catch (error) {
    if (error.response?.status === 402) {
      throw new Error('Geocoding quota exceeded. Please try again tomorrow.');
    }
    throw new Error(`Could not geocode location: ${error.message}`);
  }
}

/**
 * Fallback mock coordinates for common Indian cities.
 * Used when API key is not set (development mode).
 */
function getMockCoordinates(locationName) {
  const lower = locationName.toLowerCase();

  const cities = {
    'mumbai':    { latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata' },
    'delhi':     { latitude: 28.7041, longitude: 77.1025, timezone: 'Asia/Kolkata' },
    'bangalore': { latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
    'bengaluru': { latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
    'hyderabad': { latitude: 17.3850, longitude: 78.4867, timezone: 'Asia/Kolkata' },
    'chennai':   { latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' },
    'kolkata':   { latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata' },
    'pune':      { latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata' },
    'ahmedabad': { latitude: 23.0225, longitude: 72.5714, timezone: 'Asia/Kolkata' },
    'jaipur':    { latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata' },
  };

  for (const [city, coords] of Object.entries(cities)) {
    if (lower.includes(city)) {
      return { ...coords, formattedAddress: locationName };
    }
  }

  // Default to New Delhi if nothing matches
  console.warn(`⚠️  Unknown city "${locationName}" — defaulting to New Delhi coordinates`);
  return { latitude: 28.7041, longitude: 77.1025, formattedAddress: 'New Delhi, India', timezone: 'Asia/Kolkata' };
}

module.exports = { geocodeLocation };
