/**
 * ╔══════════════════════════════════════════════╗
 * ║   AI ROUTES                                  ║
 * ║   POST /api/ai/ask   → AI interpretation     ║
 * ║   GET  /api/ai/history → past Q&A            ║
 * ╚══════════════════════════════════════════════╝
 *
 * Every AI question:
 *   1. Verifies user is authenticated
 *   2. Checks user has credits
 *   3. Loads their saved chart from DB
 *   4. Sends chart + question to Gemini
 *   5. Deducts 1 credit
 *   6. Saves Q&A to chat_logs
 *   7. Returns AI answer
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const authMW  = require('../middleware/auth');
const { getAIInterpretation } = require('../services/aiService');
const db      = require('../services/dbService');

const router = express.Router();

// ── POST /api/ai/ask ──────────────────────────────────────────────────────────
router.post('/ask', authMW, [
  body('question')
    .trim()
    .notEmpty().withMessage('Question cannot be empty')
    .isLength({ min: 5, max: 500 }).withMessage('Question must be 5–500 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { question } = req.body;
    const userId = req.user.id;

    // ── Step 1: Check user has credits (before calling AI — saves money) ──
    const user = await db.getUserById(userId);
    const hasUnlimited = user.subscription_type === 'sage' &&
                         user.subscription_end &&
                         new Date(user.subscription_end) > new Date();

    if (!hasUnlimited && user.credits <= 0) {
      return res.status(402).json({
        error:    'INSUFFICIENT_CREDITS',
        message:  'You have no credits remaining. Please purchase more to continue.',
        credits:  0,
      });
    }

    // ── Step 2: Load user's saved chart ───────────────────────────────────
    const savedChart = await db.getChartByUserId(userId);
    if (!savedChart) {
      return res.status(404).json({
        error:   'NO_CHART',
        message: 'Please generate your birth chart first before asking questions.',
      });
    }

    const chart = savedChart.chart_data;

    // ── Step 3: Call Google Gemini AI ─────────────────────────────────────
    console.log(`🤖 AI request from user ${userId}: "${question.substring(0, 50)}..."`);
    const aiAnswer = await getAIInterpretation(chart, question);

    // ── Step 4: Deduct 1 credit (only after successful AI call) ───────────
    if (!hasUnlimited) {
      await db.deductCredit(userId);
    }

    // ── Step 5: Save to chat history ──────────────────────────────────────
    const log = await db.saveChatLog(userId, question, aiAnswer);

    // ── Step 6: Return answer ─────────────────────────────────────────────
    const updatedUser = await db.getUserById(userId);

    res.json({
      answer:          aiAnswer,
      creditsRemaining: hasUnlimited ? '∞' : updatedUser.credits,
      isUnlimited:     hasUnlimited,
      chatId:          log.id,
    });

  } catch (error) {
    // Pass credit errors through cleanly
    if (error.message === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', message: 'No credits remaining.' });
    }
    next(error);
  }
});

// ── GET /api/ai/history ───────────────────────────────────────────────────────
router.get('/history', authMW, async (req, res, next) => {
  try {
    const limit   = parseInt(req.query.limit) || 20;
    const history = await db.getChatHistory(req.user.id, limit);
    res.json({ history, count: history.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
