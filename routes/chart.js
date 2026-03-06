/**
 * ╔══════════════════════════════════════════════╗
 * ║   CHART ROUTES                               ║
 * ║   POST /api/chart/generate  → birth chart    ║
 * ║   GET  /api/chart/me        → saved chart    ║
 * ║   GET  /api/chart/horoscope → daily          ║
 * ╚══════════════════════════════════════════════╝
 *
 * Flow:
 *   1. Receive birth details from frontend
 *   2. Geocode city → lat/lng
 *   3. Calculate chart with Swiss Ephemeris
 *   4. Save to database
 *   5. Return chart to frontend
 */

const express  = require('express');
const { body, validationResult } = require('express-validator');
const authMW   = require('../middleware/auth');
const { geocodeLocation }    = require('../services/geocodingService');
const { calculateBirthChart } = require('../services/ephemerisService');
const { getDailyHoroscope }  = require('../services/aiService');
const db       = require('../services/dbService');

const router = express.Router();

// ── POST /api/chart/generate ──────────────────────────────────────────────────
router.post('/generate', authMW, [
  body('dob').isDate().withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
  body('time').matches(/^\d{2}:\d{2}$/).withMessage('Time must be HH:MM format'),
  body('location').trim().notEmpty().withMessage('Birth location is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dob, time, location } = req.body;

    // ── Step 1: Geocode the birth location ─────────────────────────────
    console.log(`📍 Geocoding: "${location}"`);
    const geoData = await geocodeLocation(location);
    console.log(`   → ${geoData.latitude}, ${geoData.longitude} (${geoData.timezone})`);

    // ── Step 2: Calculate birth chart via Swiss Ephemeris ──────────────
    console.log(`⭐ Calculating chart for ${dob} ${time}`);
    const chartData = calculateBirthChart({
      dob,
      time,
      latitude:  geoData.latitude,
      longitude: geoData.longitude,
    });

    // ── Step 3: Save to database ───────────────────────────────────────
    const saved = await db.saveChart(req.user.id, {
      dob, time, location,
      latitude:  geoData.latitude,
      longitude: geoData.longitude,
    }, chartData);

    // ── Step 4: Return to frontend ─────────────────────────────────────
    res.json({
      message:    'Birth chart generated successfully',
      chart:      chartData,
      birthPlace: geoData.formattedAddress,
      timezone:   geoData.timezone,
      chartId:    saved.id,
    });

  } catch (error) {
    next(error);
  }
});

// ── GET /api/chart/me ─────────────────────────────────────────────────────────
router.get('/me', authMW, async (req, res, next) => {
  try {
    const saved = await db.getChartByUserId(req.user.id);

    if (!saved) {
      return res.status(404).json({
        error: 'No chart found. Please generate your birth chart first.'
      });
    }

    res.json({
      chart:      saved.chart_data,
      birthPlace: saved.birth_place,
      dob:        saved.dob,
      birthTime:  saved.birth_time,
    });

  } catch (error) {
    next(error);
  }
});

// ── GET /api/chart/horoscope ──────────────────────────────────────────────────
// Returns today's AI-generated horoscope (uses cheaper Gemini Flash model)
router.get('/horoscope', authMW, async (req, res, next) => {
  try {
    const saved = await db.getChartByUserId(req.user.id);
    if (!saved) {
      return res.status(404).json({ error: 'Please generate your birth chart first.' });
    }

    const horoscope = await getDailyHoroscope(saved.chart_data);
    res.json({ horoscope, date: new Date().toISOString().split('T')[0] });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
