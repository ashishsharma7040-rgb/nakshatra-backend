/**
 * ╔══════════════════════════════════════════════════╗
 * ║         NAKSHATRA AI — BACKEND SERVER            ║
 * ║  Node.js + Express · Swiss Ephemeris · Gemini    ║
 * ╚══════════════════════════════════════════════════╝
 *
 * HOW TO RUN:
 *   1. npm install
 *   2. Copy .env.example → .env and fill in your keys
 *   3. node server.js   (or: npm run dev)
 */

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const morgan        = require('morgan');
require('dotenv').config();

// ── Route imports ─────────────────────────────────
const authRoutes    = require('./routes/auth');
const chartRoutes   = require('./routes/chart');
const aiRoutes      = require('./routes/ai');
const paymentRoutes = require('./routes/payment');
const userRoutes    = require('./routes/user');

// ── App setup ─────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware ───────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting (protect AI endpoint especially) ─
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please slow down.' }
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 5,
  message: { error: 'AI rate limit reached. Please wait a moment.' }
});

app.use(generalLimiter);
app.use(express.json());
app.use(morgan('dev'));

// ── Health check ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Nakshatra AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── Mount routes ──────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/chart',   chartRoutes);
app.use('/api/ai',      aiLimiter, aiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user',    userRoutes);

// ── Global error handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ✦ ─────────────────────────────────── ✦
     Nakshatra AI Backend is running
     http://localhost:${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
  ✦ ─────────────────────────────────── ✦
  `);
});

module.exports = app;
