// routes/chart.js
const express  = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth    = require('../middleware/auth');
const { pool }       = require('../services/dbService');
const { geocode }    = require('../services/geocodingService');
const { calculateChart } = require('../services/ephemerisService');

const router = express.Router();

// POST /api/chart/generate
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

    // Validate DOB is not future
    const dobDate = new Date(dob);
    const today   = new Date(); today.setHours(0,0,0,0);
    if (dobDate >= today) {
      return res.status(400).json({ error: 'Date of birth cannot be today or in the future.' });
    }
    const ageYears = (today - dobDate) / (365.25 * 24 * 3600 * 1000);
    if (ageYears > 120) {
      return res.status(400).json({ error: 'Date of birth cannot be more than 120 years ago.' });
    }

    try {
      // Step 1: Geocode location
      let geoData;
      try {
        geoData = await geocode(location);
      } catch (geoErr) {
        return res.status(400).json({ error: geoErr.message });
      }

      // Step 2: Calculate chart via Swiss Ephemeris / fallback
      let chartData;
      try {
        chartData = await calculateChart({
          dob,
          time,
          latitude:  geoData.lat,
          longitude: geoData.lon,
        });
      } catch (calcErr) {
        console.error('Chart calc error:', calcErr.message);
        return res.status(500).json({ error: 'Planetary calculation failed. Please try again.' });
      }

      // Step 3: Upsert chart into DB
      await pool.query(
        `INSERT INTO charts (user_id, dob, birth_time, birth_place, latitude, longitude, chart_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id) DO UPDATE SET
           dob=EXCLUDED.dob, birth_time=EXCLUDED.birth_time, birth_place=EXCLUDED.birth_place,
           latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
           chart_data=EXCLUDED.chart_data, updated_at=NOW()`,
        [req.user.id, dob, time, geoData.displayName || location, geoData.lat, geoData.lon, JSON.stringify(chartData)]
      );

      // Step 4: Return chart + credit count
      const userRow = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
      const credits = userRow.rows[0]?.credits ?? 5;

      return res.json({
        chart:      chartData,
        birthPlace: geoData.displayName || location,
        latitude:   geoData.lat,
        longitude:  geoData.lon,
        credits,
      });

    } catch (err) {
      console.error('Generate chart error:', err.message);
      return res.status(500).json({ error: 'Chart generation failed. Please try again.' });
    }
  }
);

// GET /api/chart/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT chart_data, dob, birth_time, birth_place, latitude, longitude, updated_at FROM charts WHERE user_id=$1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No chart found. Please generate your birth chart first.' });
    }
    const row = result.rows[0];
    return res.json({
      chart: {
        chart_data:  row.chart_data,
        dob:         row.dob,
        birth_time:  row.birth_time,
        birth_place: row.birth_place,
        latitude:    row.latitude,
        longitude:   row.longitude,
        updated_at:  row.updated_at,
      },
    });
  } catch (err) {
    console.error('Fetch chart error:', err.message);
    return res.status(500).json({ error: 'Could not load chart.' });
  }
});

module.exports = router;
