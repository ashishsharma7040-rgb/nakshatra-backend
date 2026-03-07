require('dotenv').config();

// ── Env check ─────────────────────────────────────────────────────────────────
['DATABASE_URL','JWT_SECRET','GEMINI_API_KEY'].forEach(k => {
  if (!process.env[k]) console.error(`⚠ WARNING: ${k} is not set`);
});

const express = require('express');
const cors    = require('cors');

// ── Load routes safely ────────────────────────────────────────────────────────
let authRoutes, chartRoutes, aiRoutes, paymentRoutes, userRoutes;
try { authRoutes    = require('./routes/auth');    } catch(e) { console.error('routes/auth failed:',    e.message); }
try { chartRoutes   = require('./routes/chart');   } catch(e) { console.error('routes/chart failed:',   e.message); }
try { aiRoutes      = require('./routes/ai');      } catch(e) { console.error('routes/ai failed:',      e.message); }
try { paymentRoutes = require('./routes/payment'); } catch(e) { console.error('routes/payment failed:', e.message); }
try { userRoutes    = require('./routes/user');    } catch(e) { console.error('routes/user failed:',    e.message); }

// ── DB init ───────────────────────────────────────────────────────────────────
const { initDB } = require('./services/dbService');
initDB().catch(err => console.error('DB init failed:', err.message));

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin)                            return cb(null, true);
    if (origin.includes('vercel.app'))      return cb(null, true);
    if (origin.includes('localhost'))       return cb(null, true);
    if (origin.includes('127.0.0.1'))       return cb(null, true);
    const fe = process.env.FRONTEND_URL;
    if (fe && origin === fe)                return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  ts:     new Date().toISOString(),
  env: {
    db:     !!process.env.DATABASE_URL,
    jwt:    !!process.env.JWT_SECRET,
    gemini: !!process.env.GEMINI_API_KEY,
    email:  !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  }
}));

// ── Mount routes ──────────────────────────────────────────────────────────────
if (authRoutes)    app.use('/api/auth',     authRoutes);
if (chartRoutes)   app.use('/api/chart',    chartRoutes);
if (aiRoutes)      app.use('/api/ai',       aiRoutes);
// Mount on BOTH /api/payment and /api/payments — frontend uses /api/payments
if (paymentRoutes) {
  app.use('/api/payment',  paymentRoutes);
  app.use('/api/payments', paymentRoutes);
}
if (userRoutes)    app.use('/api/user',     userRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error:'Internal server error', detail:err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✓ Nakshatra backend on port ${PORT}`);
  console.log(`  DB:       ${!!process.env.DATABASE_URL}`);
  console.log(`  JWT:      ${!!process.env.JWT_SECRET}`);
  console.log(`  Gemini:   ${!!process.env.GEMINI_API_KEY}`);
  console.log(`  Email:    ${!!(process.env.EMAIL_USER && process.env.EMAIL_PASS)}`);
  console.log(`  Razorpay: ${!!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)}`);
});
