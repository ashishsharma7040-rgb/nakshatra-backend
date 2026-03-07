require('dotenv').config();

// ── Startup env check ─────────────────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY'];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`⚠ WARNING: ${key} is not set in environment variables`);
  }
});

const express = require('express');
const cors    = require('cors');

// ── Load routes ───────────────────────────────────────────────────────────────
let authRoutes, chartRoutes, aiRoutes, paymentRoutes, userRoutes;
try { authRoutes    = require('./routes/auth');    } catch(e) { console.error('Failed to load routes/auth:',    e.message); }
try { chartRoutes   = require('./routes/chart');   } catch(e) { console.error('Failed to load routes/chart:',   e.message); }
try { aiRoutes      = require('./routes/ai');      } catch(e) { console.error('Failed to load routes/ai:',      e.message); }
try { paymentRoutes = require('./routes/payment'); } catch(e) { console.error('Failed to load routes/payment:', e.message); }
try { userRoutes    = require('./routes/user');    } catch(e) { console.error('Failed to load routes/user:',    e.message); }

const { initDB } = require('./services/dbService');
initDB().catch(err => console.error('DB init failed:', err.message));

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow any vercel.app subdomain + localhost for dev
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server or curl
    if (origin.includes('vercel.app'))  return callback(null, true);
    if (origin.includes('localhost'))   return callback(null, true);
    if (origin.includes('127.0.0.1'))   return callback(null, true);
    // Also allow explicit FRONTEND_URL env var
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    console.warn('CORS blocked origin:', origin);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    env: {
      db:     !!process.env.DATABASE_URL,
      jwt:    !!process.env.JWT_SECRET,
      gemini: !!process.env.GEMINI_API_KEY,
    },
  });
});

// ── Mount routes ──────────────────────────────────────────────────────────────
// IMPORTANT: payment is mounted on BOTH /api/payment AND /api/payments
// because App.jsx calls /api/payments (with S) but the file is payment.js
if (authRoutes)    app.use('/api/auth',     authRoutes);
if (chartRoutes)   app.use('/api/chart',    chartRoutes);
if (aiRoutes)      app.use('/api/ai',       aiRoutes);
if (paymentRoutes) app.use('/api/payment',  paymentRoutes);  // keep original
if (paymentRoutes) app.use('/api/payments', paymentRoutes);  // FIX: App.jsx calls this
if (userRoutes)    app.use('/api/user',     userRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✓ Nakshatra backend running on port ${PORT}`);
  console.log(`  DB configured:     ${!!process.env.DATABASE_URL}`);
  console.log(`  JWT configured:    ${!!process.env.JWT_SECRET}`);
  console.log(`  Gemini configured: ${!!process.env.GEMINI_API_KEY}`);
});
