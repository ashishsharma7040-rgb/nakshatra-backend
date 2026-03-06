require('dotenv').config();

// ── Startup env check — logs missing vars clearly in Render logs ──────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY'];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`⚠ WARNING: ${key} is not set in environment variables`);
  }
});

const express = require('express');
const cors    = require('cors');

// Load routes — wrapped in try/catch so one bad file doesn't kill the server
let authRoutes, chartRoutes, aiRoutes, paymentRoutes, userRoutes;
try { authRoutes    = require('./routes/auth');    } catch(e) { console.error('Failed to load routes/auth:', e.message); }
try { chartRoutes   = require('./routes/chart');   } catch(e) { console.error('Failed to load routes/chart:', e.message); }
try { aiRoutes      = require('./routes/ai');      } catch(e) { console.error('Failed to load routes/ai:', e.message); }
try { paymentRoutes = require('./routes/payment'); } catch(e) { console.error('Failed to load routes/payment:', e.message); }
try { userRoutes    = require('./routes/user');    } catch(e) { console.error('Failed to load routes/user:', e.message); }

const { initDB } = require('./services/dbService');
initDB().catch(err => console.error('DB init failed:', err.message));

const app = express();

// ── CORS — allow all vercel.app URLs ─────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes('vercel.app')) return callback(null, true);
    if (origin.includes('localhost'))  return callback(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check — always works even if DB is down ───────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    env: {
      db:     !!process.env.DATABASE_URL,
      jwt:    !!process.env.JWT_SECRET,
      gemini: !!process.env.GEMINI_API_KEY,
    }
  });
});

// ── Routes — only mount if loaded successfully ────────────────────────────────
if (authRoutes)    app.use('/api/auth',    authRoutes);
if (chartRoutes)   app.use('/api/chart',   chartRoutes);
if (aiRoutes)      app.use('/api/ai',      aiRoutes);
if (paymentRoutes) app.use('/api/payment', paymentRoutes);
if (userRoutes)    app.use('/api/user',    userRoutes);

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
