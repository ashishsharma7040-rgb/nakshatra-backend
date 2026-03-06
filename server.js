require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth');
const chartRoutes   = require('./routes/chart');
const aiRoutes      = require('./routes/ai');
const paymentRoutes = require('./routes/payment');
const userRoutes    = require('./routes/user');
const { initDB }    = require('./services/dbService');

// Initialise DB tables on startup
initDB().catch(err => console.error('DB init failed:', err.message));

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow all vercel.app URLs + localhost — fixes CORS for all Vercel preview URLs
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);             // health checks, curl
    if (origin.includes('vercel.app')) return callback(null, true); // all Vercel URLs
    if (origin.includes('localhost'))  return callback(null, true); // local dev
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);                        // custom domain
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/chart',   chartRoutes);
app.use('/api/ai',      aiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user',    userRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✓ Nakshatra backend running on port ${PORT}`));
