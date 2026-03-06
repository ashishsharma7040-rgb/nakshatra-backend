/**
 * ╔══════════════════════════════════════════════════╗
 * ║   PAYMENT ROUTES (Razorpay)                      ║
 * ║   POST /api/payment/create-order  → order ID     ║
 * ║   POST /api/payment/verify        → add credits  ║
 * ╚══════════════════════════════════════════════════╝
 *
 * Razorpay Payment Flow:
 *
 *   1. Frontend: user clicks "Buy ₹299"
 *   2. Backend:  POST /create-order → Razorpay returns order ID
 *   3. Frontend: Razorpay popup opens (handles UPI, cards, netbanking)
 *   4. User pays successfully in popup
 *   5. Frontend: sends payment details to /verify
 *   6. Backend:  verifies signature (security check!)
 *   7. Backend:  adds credits to user account
 *   8. Frontend: shows "Credits added!" message
 *
 * Test cards: https://razorpay.com/docs/payments/payments/test-card-details/
 */

const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const authMW   = require('../middleware/auth');
const db       = require('../services/dbService');

const router = express.Router();

// ── Credit plans ───────────────────────────────────────────────────────────────
const PLANS = {
  starter: {
    name:    'Seeker',
    credits: 5,
    amount:  parseInt(process.env.PRICE_STARTER) || 9900,   // paise (₹99)
    type:    'credits',
  },
  popular: {
    name:    'Devotee',
    credits: 20,
    amount:  parseInt(process.env.PRICE_POPULAR) || 29900,  // paise (₹299)
    type:    'credits',
  },
  sage: {
    name:    'Sage',
    credits: 0,
    amount:  parseInt(process.env.PRICE_SAGE) || 99900,     // paise (₹999)
    type:    'unlimited',
    days:    30,
  },
};

// ── Razorpay client ────────────────────────────────────────────────────────────
function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// ── POST /api/payment/create-order ────────────────────────────────────────────
router.post('/create-order', authMW, async (req, res, next) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: `Invalid plan. Choose: ${Object.keys(PLANS).join(', ')}` });
    }

    const selectedPlan = PLANS[plan];
    const razorpay     = getRazorpay();

    const order = await razorpay.orders.create({
      amount:   selectedPlan.amount,
      currency: 'INR',
      receipt:  `nksh_${req.user.id}_${Date.now()}`,
      notes: {
        userId: req.user.id,
        plan,
      },
    });

    // Log the pending transaction
    await db.logTransaction(req.user.id, {
      orderId: order.id,
      plan,
      amount:  selectedPlan.amount,
      status:  'pending',
    });

    res.json({
      orderId:   order.id,
      amount:    selectedPlan.amount,
      currency:  'INR',
      planName:  selectedPlan.name,
      keyId:     process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    next(error);
  }
});

// ── POST /api/payment/verify ──────────────────────────────────────────────────
// Called after user completes payment in Razorpay popup
router.post('/verify', authMW, async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = req.body;

    // ── CRITICAL: Verify the payment signature ──────────────────────────
    // This prevents fake payment confirmations
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        error: 'Payment verification failed. Signature mismatch.'
      });
    }

    // ── Payment is legitimate — add credits ─────────────────────────────
    const selectedPlan = PLANS[plan];

    if (selectedPlan.type === 'unlimited') {
      await db.setUnlimitedSubscription(req.user.id, selectedPlan.days);
    } else {
      await db.addCredits(req.user.id, selectedPlan.credits);
    }

    // Update transaction log
    await db.logTransaction(req.user.id, {
      orderId:   razorpay_order_id,
      plan,
      amount:    selectedPlan.amount,
      status:    'completed',
    });

    // Get updated user
    const updatedUser = await db.getUserById(req.user.id);

    res.json({
      success:  true,
      message:  selectedPlan.type === 'unlimited'
        ? '✦ Sage plan activated! Unlimited questions for 30 days.'
        : `✦ ${selectedPlan.credits} credits added to your account.`,
      credits:  updatedUser.credits,
      subscription: updatedUser.subscription_type,
    });

  } catch (error) {
    next(error);
  }
});

// ── GET /api/payment/plans ────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

module.exports = router;
