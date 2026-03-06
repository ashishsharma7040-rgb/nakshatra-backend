// routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../services/dbService');
const requireAuth = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/register
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const hashed = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (name, email, password, credits) VALUES ($1,$2,$3,$4) RETURNING id,name,email,credits',
        [name, email, hashed, 5]  // ← 5 free credits on registration
      );
      const user  = result.rows[0];
      const token = signToken(user);

      return res.status(201).json({
        token,
        user:    { id: user.id, name: user.name, email: user.email },
        credits: user.credits,
      });
    } catch (err) {
      console.error('Register error:', err.message);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const result = await pool.query(
        'SELECT id,name,email,password,credits FROM users WHERE email=$1', [email]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'No account found with this email.' });
      }
      const user  = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password.' });

      const token = signToken(user);
      return res.json({
        token,
        user:    { id: user.id, name: user.name, email: user.email },
        credits: user.credits,
      });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,name,email,credits,created_at FROM users WHERE id=$1', [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch profile.' });
  }
});

module.exports = router;
