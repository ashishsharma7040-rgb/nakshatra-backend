// routes/ai.js
const express  = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth      = require('../middleware/auth');
const { pool }         = require('../services/dbService');
const { getAIReading } = require('../services/aiService');

const router = express.Router();

// POST /api/ai/ask
router.post('/ask',
  requireAuth,
  [
    body('question').trim().notEmpty().withMessage('Question is required')
      .isLength({ max: 500 }).withMessage('Question must be under 500 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { question } = req.body;
    const userId = req.user.id;

    // 1. Check credits
    let userName, credits;
    try {
      const userRow = await pool.query('SELECT name, credits FROM users WHERE id=$1', [userId]);
      if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      userName = userRow.rows[0].name;
      credits  = userRow.rows[0].credits;
    } catch (err) {
      console.error('Credits check error:', err.message);
      return res.status(500).json({ error: `Database error: ${err.message}` });
    }

    if (credits <= 0) {
      return res.status(402).json({ error: 'Insufficient credits. Please purchase more.', creditsRemaining: 0 });
    }

    // 2. Load chart
    let chartData;
    try {
      const chartRow = await pool.query('SELECT chart_data FROM charts WHERE user_id=$1', [userId]);
      if (chartRow.rows.length === 0) {
        return res.status(400).json({ error: 'NO_CHART', message: 'Please generate your birth chart first.' });
      }
      chartData = chartRow.rows[0].chart_data;
    } catch (err) {
      console.error('Chart load error:', err.message);
      return res.status(500).json({ error: `Chart load error: ${err.message}` });
    }

    // 3. Call Gemini
    let answer;
    try {
      answer = await getAIReading(chartData, question, userName);
    } catch (aiErr) {
      console.error('Gemini error:', aiErr.message);
      return res.status(500).json({ error: `AI service error: ${aiErr.message}` });
    }

    // 4. Deduct 1 credit
    let creditsRemaining;
    try {
      const updated = await pool.query(
        'UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING credits',
        [userId]
      );
      creditsRemaining = updated.rows[0]?.credits ?? (credits - 1);
    } catch (err) {
      console.error('Credits deduct error:', err.message);
      // Don't fail — answer was already generated, just log it
      creditsRemaining = credits - 1;
    }

    // 5. Save chat history — don't fail if this errors
    try {
      await pool.query(
        'INSERT INTO chats (user_id, question, answer) VALUES ($1,$2,$3)',
        [userId, question, answer]
      );
    } catch (err) {
      console.error('Chat save error:', err.message);
      // Non-fatal — user still gets their answer
    }

    return res.json({ answer, creditsRemaining });
  }
);

// GET /api/ai/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT question, answer, created_at FROM chats WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    return res.json({ chats: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load chat history.' });
  }
});

module.exports = router;
