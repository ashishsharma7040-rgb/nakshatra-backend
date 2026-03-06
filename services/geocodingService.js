// services/geocodingService.js
// Converts place name → { lat, lon } using OpenStreetMap Nominatim (free, no API key).
// Falls back to hardcoded Indian city coords if API fails.

const fetch = require('node-fetch');

const INDIAN_CITIES = {
  'mumbai':     { lat: 19.0760,  lon: 72.8777 },
  'delhi':      { lat: 28.7041,  lon: 77.1025 },
  'new delhi':  { lat: 28.6139,  lon: 77.2090 },
  'bangalore':  { lat: 12.9716,  lon: 77.5946 },
  'bengaluru':  { lat: 12.9716,  lon: 77.5946 },
  'chennai':    { lat: 13.0827,  lon: 80.2707 },
  'kolkata':    { lat: 22.5726,  lon: 88.3639 },
  'hyderabad':  { lat: 17.3850,  lon: 78.4867 },
  'pune':       { lat: 18.5204,  lon: 73.8567 },
  'ahmedabad':  { lat: 23.0225,  lon: 72.5714 },
  'jaipur':     { lat: 26.9124,  lon: 75.7873 },
  'surat':      { lat: 21.1702,  lon: 72.8311 },
  'lucknow':    { lat: 26.8467,  lon: 80.9462 },
  'kanpur':     { lat: 26.4499,  lon: 80.3319 },
  'nagpur':     { lat: 21.1458,  lon: 79.0882 },
  'indore':     { lat: 22.7196,  lon: 75.8577 },
  'bhopal':     { lat: 23.2599,  lon: 77.4126 },
  'patna':      { lat: 25.5941,  lon: 85.1376 },
  'vadodara':   { lat: 22.3072,  lon: 73.1812 },
  'coimbatore': { lat: 11.0168,  lon: 76.9558 },
  'agra':       { lat: 27.1767,  lon: 78.0081 },
  'nashik':     { lat: 19.9975,  lon: 73.7898 },
  'faridabad':  { lat: 28.4089,  lon: 77.3178 },
  'meerut':     { lat: 28.9845,  lon: 77.7064 },
  'rajkot':     { lat: 22.3039,  lon: 70.8022 },
  'varanasi':   { lat: 25.3176,  lon: 82.9739 },
  'amritsar':   { lat: 31.6340,  lon: 74.8723 },
  'allahabad':  { lat: 25.4358,  lon: 81.8463 },
  'prayagraj':  { lat: 25.4358,  lon: 81.8463 },
  'howrah':     { lat: 22.5958,  lon: 88.2636 },
  'aurangabad': { lat: 19.8762,  lon: 75.3433 },
  'ranchi':     { lat: 23.3441,  lon: 85.3096 },
  'chandigarh': { lat: 30.7333,  lon: 76.7794 },
  'guwahati':   { lat: 26.1445,  lon: 91.7362 },
  'srinagar':   { lat: 34.0837,  lon: 74.7973 },
  'thiruvananthapuram': { lat: 8.5241, lon: 76.9366 },
  'trivandrum': { lat: 8.5241,   lon: 76.9366 },
  'kochi':      { lat: 9.9312,   lon: 76.2673 },
  'mysore':     { lat: 12.2958,  lon: 76.6394 },
  'mysuru':     { lat: 12.2958,  lon: 76.6394 },
  'visakhapatnam': { lat: 17.6868, lon: 83.2185 },
  'vijayawada': { lat: 16.5062,  lon: 80.6480 },
  'jodhpur':    { lat: 26.2389,  lon: 73.0243 },
  'udaipur':    { lat: 24.5854,  lon: 73.7125 },
  'jabalpur':   { lat: 23.1815,  lon: 79.9864 },
  'gwalior':    { lat: 26.2183,  lon: 78.1828 },
  'jammu':      { lat: 32.7266,  lon: 74.8570 },
  'raipur':     { lat: 21.2514,  lon: 81.6296 },
  'dehradun':   { lat: 30.3165,  lon: 78.0322 },
  'shimla':     { lat: 31.1048,  lon: 77.1734 },
};

async function geocode(locationStr) {
  // 1. Try Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'NakshatraAI/1.0' },
      timeout: 8000,
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat:         parseFloat(data[0].lat),
        lon:         parseFloat(data[0].lon),
        displayName: data[0].display_name || locationStr,
      };
    }
  } catch (err) {
    console.warn('Nominatim failed:', err.message);
  }

  // 2. Fallback: exact match
  const key = locationStr.toLowerCase().split(',')[0].trim();
  if (INDIAN_CITIES[key]) {
    return { lat: INDIAN_CITIES[key].lat, lon: INDIAN_CITIES[key].lon, displayName: locationStr };
  }

  // 3. Partial match
  for (const [city, coords] of Object.entries(INDIAN_CITIES)) {
    if (key.includes(city) || city.includes(key)) {
      return { lat: coords.lat, lon: coords.lon, displayName: locationStr };
    }
  }

  throw new Error(`Could not find coordinates for "${locationStr}". Please use format: "City, State, India"`);
}

module.exports = { geocode };
