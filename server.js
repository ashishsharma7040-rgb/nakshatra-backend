require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth');
const chartRoutes   = require('./routes/chart');
const aiRoutes      = require('./routes/ai');
const paymentRoutes = require('./routes/payment');   // your file is payment.js
const userRoutes    = require('./routes/user');
const { initDB }    = require('./services/dbService'); // your file is dbService.js

// Initialise DB tables on startup
initDB().catch(err => console.error('DB init failed:', err.message));

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://nakshatra-frontend.vercel.app',   // your Vercel URL from image 1
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) return callback(null, true);
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

// ── Health check (Render uses this to verify service is up) ──────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✓ Nakshatra backend running on port ${PORT}`));
