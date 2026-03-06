/**
 * ╔══════════════════════════════════════╗
 * ║   AUTH ROUTES                        ║
 * ║   POST /api/auth/register            ║
 * ║   POST /api/auth/login               ║
 * ║   GET  /api/auth/me                  ║
 * ╚══════════════════════════════════════╝
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db        = require('../services/dbService');
const authMW    = require('../middleware/auth');

const router = express.Router();

// ── Helper: create JWT token ──────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password (never store plain text!)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (starts with 0 credits — buy to get access)
    const user = await db.createUser({ email, passwordHash, name });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully! Welcome to Nakshatra AI.',
      token,
      user: { id: user.id, name: user.name, email: user.email, credits: 0 },
    });

  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await db.getUserByEmail(email);
    if (!user) {
      // Same message for both cases (security: don't reveal if email exists)
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Welcome back!',
      token,
      user: {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        credits: user.credits,
        subscription_type: user.subscription_type,
      },
    });

  } catch (error) {
    next(error);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMW, async (req, res, next) => {
  try {
    const user = await db.getUserById(req.user.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
