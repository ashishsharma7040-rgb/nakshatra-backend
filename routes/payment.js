// routes/payment.js  (note: your repo uses payment.js, not payments.js)
const express  = require('express');
const crypto   = require('crypto');
const requireAuth = require('../middleware/auth');
const { pool } = require('../services/dbService');

const router = express.Router();

const PLANS = {
  starter: { price: 9900,  credits: 5,    label: 'Seeker'  },
  popular: { price: 29900, credits: 20,   label: 'Devotee' },
  sage:    { price: 99900, credits: 9999, label: 'Sage'    },
};

// POST /api/payment/create-order
router.post('/create-order', requireAuth, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan.' });

  let razorpay;
  try {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch {
    return res.status(500).json({ error: 'Payment gateway not configured.' });
  }

  try {
    const order = await razorpay.orders.create({
      amount:   plan.price,
      currency: 'INR',
      receipt:  `nk_${req.user.id}_${Date.now()}`,
      notes:    { userId: req.user.id, planId },
    });

    await pool.query(
      `INSERT INTO payments (user_id, razorpay_order_id, plan, amount, credits_added, status)
       VALUES ($1,$2,$3,$4,$5,'pending')`,
      [req.user.id, order.id, planId, plan.price, plan.credits]
    );

    return res.json({ orderId: order.id, amount: plan.price, currency: 'INR', plan: plan.label });
  } catch (err) {
    console.error('Create order error:', err.message);
    return res.status(500).json({ error: 'Could not create payment order.' });
  }
});

// POST /api/payment/verify
router.post('/verify', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields.' });
  }

  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body).digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed.' });
  }

  try {
    const payRow = await pool.query(
      'SELECT * FROM payments WHERE razorpay_order_id=$1 AND user_id=$2',
      [razorpay_order_id, req.user.id]
    );
    if (payRow.rows.length === 0) return res.status(404).json({ error: 'Payment record not found.' });

    const payment = payRow.rows[0];
    if (payment.status === 'paid') {
      const u = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
      return res.json({ already: true, credits: u.rows[0].credits });
    }

    const updatedUser = await pool.query(
      'UPDATE users SET credits=credits+$1 WHERE id=$2 RETURNING credits',
      [payment.credits_added, req.user.id]
    );
    await pool.query(
      'UPDATE payments SET status=\'paid\', razorpay_payment_id=$1 WHERE id=$2',
      [razorpay_payment_id, payment.id]
    );

    return res.json({ success: true, credits: updatedUser.rows[0].credits, added: payment.credits_added });
  } catch (err) {
    console.error('Verify error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// GET /api/payment/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT plan, amount, credits_added, status, created_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    return res.json({ payments: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load payment history.' });
  }
});

module.exports = router;
