// routes/ai.js
const express  = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth    = require('../middleware/auth');
const { pool }       = require('../services/dbService');
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

    try {
      // 1. Check credits
      const userRow = await pool.query('SELECT name, credits FROM users WHERE id=$1', [userId]);
      if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

      const { name: userName, credits } = userRow.rows[0];
      if (credits <= 0) {
        return res.status(402).json({ error: 'Insufficient credits. Please purchase more.', creditsRemaining: 0 });
      }

      // 2. Load this user's real chart from DB
      const chartRow = await pool.query('SELECT chart_data FROM charts WHERE user_id=$1', [userId]);
      if (chartRow.rows.length === 0) {
        return res.status(400).json({ error: 'NO_CHART', message: 'Please generate your birth chart first.' });
      }

      const chartData = chartRow.rows[0].chart_data;

      // 3. Call Gemini with the real chart + question
      let answer;
      try {
        answer = await getAIReading(chartData, question, userName);
      } catch (aiErr) {
        console.error('Gemini error:', aiErr.message);
        return res.status(500).json({ error: `AI service error: ${aiErr.message}` });
      }

      // 4. Deduct 1 credit atomically
      const updated = await pool.query(
        'UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING credits',
        [userId]
      );
      const creditsRemaining = updated.rows[0]?.credits ?? (credits - 1);

      // 5. Save to chat history
      await pool.query(
        'INSERT INTO chats (user_id, question, answer) VALUES ($1,$2,$3)',
        [userId, question, answer]
      );

      return res.json({ answer, creditsRemaining });

    } catch (err) {
      console.error('AI ask error:', err.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
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
