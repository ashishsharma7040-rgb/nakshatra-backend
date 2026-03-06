/**
 * ╔═══════════════════════════════════════╗
 * ║   DATABASE SERVICE                    ║
 * ║   Supabase (PostgreSQL in the cloud)  ║
 * ║   Free tier: 500MB, unlimited API     ║
 * ╚═══════════════════════════════════════╝
 *
 * SETUP (takes 5 minutes):
 *   1. Go to https://supabase.com → New Project
 *   2. Copy Project URL and service_role key → .env
 *   3. Run the SQL in /config/database.sql in Supabase SQL editor
 *   4. Done!
 *
 * Tables:
 *   users       - accounts, credits, subscription
 *   charts      - birth chart data (stored as JSON)
 *   chat_logs   - AI questions and answers
 *   transactions - payment history
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getDB() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

// ── USER operations ────────────────────────────────────────────────────────────

async function createUser({ email, passwordHash, name }) {
  const db = getDB();
  const { data, error } = await db
    .from('users')
    .insert({ email, password_hash: passwordHash, name, credits: 0 })
    .select()
    .single();

  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data;
}

async function getUserByEmail(email) {
  const db = getDB();
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

async function getUserById(id) {
  const db = getDB();
  const { data, error } = await db
    .from('users')
    .select('id, name, email, credits, subscription_type, subscription_end')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

async function deductCredit(userId) {
  const db = getDB();

  // Check current credits first
  const user = await getUserById(userId);

  // If on unlimited plan and it's still active, skip deduction
  if (user.subscription_type === 'sage' && new Date(user.subscription_end) > new Date()) {
    return true;
  }

  if (user.credits <= 0) {
    throw new Error('INSUFFICIENT_CREDITS');
  }

  const { error } = await db
    .from('users')
    .update({ credits: user.credits - 1 })
    .eq('id', userId);

  if (error) throw error;
  return true;
}

async function addCredits(userId, amount) {
  const db = getDB();
  const user = await getUserById(userId);

  const { error } = await db
    .from('users')
    .update({ credits: (user.credits || 0) + amount })
    .eq('id', userId);

  if (error) throw error;
}

async function setUnlimitedSubscription(userId, days = 30) {
  const db = getDB();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { error } = await db
    .from('users')
    .update({ subscription_type: 'sage', subscription_end: endDate.toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

// ── CHART operations ───────────────────────────────────────────────────────────

async function saveChart(userId, birthDetails, chartData) {
  const db = getDB();
  const { data, error } = await db
    .from('charts')
    .upsert({
      user_id:       userId,
      dob:           birthDetails.dob,
      birth_time:    birthDetails.time,
      birth_place:   birthDetails.location,
      latitude:      birthDetails.latitude,
      longitude:     birthDetails.longitude,
      chart_data:    chartData,          // stored as JSONB
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' })        // one chart per user
    .select()
    .single();

  if (error) throw new Error(`saveChart failed: ${error.message}`);
  return data;
}

async function getChartByUserId(userId) {
  const db = getDB();
  const { data, error } = await db
    .from('charts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ── CHAT LOG operations ────────────────────────────────────────────────────────

async function saveChatLog(userId, question, aiAnswer) {
  const db = getDB();
  const { data, error } = await db
    .from('chat_logs')
    .insert({
      user_id:    userId,
      question,
      ai_answer:  aiAnswer,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`saveChatLog failed: ${error.message}`);
  return data;
}

async function getChatHistory(userId, limit = 20) {
  const db = getDB();
  const { data, error } = await db
    .from('chat_logs')
    .select('id, question, ai_answer, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ── TRANSACTION logging ────────────────────────────────────────────────────────

async function logTransaction(userId, { orderId, plan, amount, status }) {
  const db = getDB();
  const { error } = await db
    .from('transactions')
    .insert({
      user_id:    userId,
      order_id:   orderId,
      plan,
      amount,
      status,
      created_at: new Date().toISOString(),
    });

  if (error) throw error;
}

module.exports = {
  createUser, getUserByEmail, getUserById,
  deductCredit, addCredits, setUnlimitedSubscription,
  saveChart, getChartByUserId,
  saveChatLog, getChatHistory,
  logTransaction,
};
