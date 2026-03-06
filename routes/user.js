/**
 * ╔══════════════════════════════════╗
 * ║   USER ROUTES                    ║
 * ║   GET  /api/user/profile         ║
 * ║   GET  /api/user/credits         ║
 * ╚══════════════════════════════════╝
 */

const express = require('express');
const authMW  = require('../middleware/auth');
const db      = require('../services/dbService');

const router = express.Router();

// ── GET /api/user/profile ─────────────────────────────────────────────────────
router.get('/profile', authMW, async (req, res, next) => {
  try {
    const user  = await db.getUserById(req.user.id);
    const chart = await db.getChartByUserId(req.user.id);
    const history = await db.getChatHistory(req.user.id, 5);

    const hasUnlimited = user.subscription_type === 'sage' &&
                         user.subscription_end &&
                         new Date(user.subscription_end) > new Date();

    res.json({
      user: {
        id:                user.id,
        name:              user.name,
        email:             user.email,
        credits:           hasUnlimited ? '∞' : user.credits,
        subscription_type: user.subscription_type,
        subscription_end:  user.subscription_end,
        hasUnlimited,
      },
      hasChart:     !!chart,
      recentChats:  history,
    });

  } catch (error) {
    next(error);
  }
});

// ── GET /api/user/credits ─────────────────────────────────────────────────────
router.get('/credits', authMW, async (req, res, next) => {
  try {
    const user = await db.getUserById(req.user.id);
    const hasUnlimited = user.subscription_type === 'sage' &&
                         user.subscription_end &&
                         new Date(user.subscription_end) > new Date();

    res.json({
      credits:     hasUnlimited ? '∞' : user.credits,
      hasUnlimited,
      plan:        user.subscription_type || 'free',
      expiresAt:   user.subscription_end,
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
