// routes/user.js
const express  = require('express');
const requireAuth = require('../middleware/auth');
const { pool } = require('../services/dbService');

const router = express.Router();

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, credits, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch profile.' });
  }
});

// GET /api/user/credits
router.get('/credits', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ credits: result.rows[0].credits });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch credits.' });
  }
});

module.exports = router;
