// services/dbService.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  console.error('Go to Render → nakshatra-backend → Environment → Add DATABASE_URL');
}

// ── Detect if this is a Supabase connection ───────────────────────────────────
const isSupabase = (process.env.DATABASE_URL || '').includes('supabase.co');
const needsSSL   = (process.env.DATABASE_URL || '').includes('supabase.co')
                || (process.env.DATABASE_URL || '').includes('sslmode=require')
                || (process.env.DATABASE_URL || '').includes('amazonaws.com');

let pool;
try {
  pool = new Pool({
    connectionString:       process.env.DATABASE_URL,
    ssl:                    needsSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,   // wait up to 15s for a connection
    idleTimeoutMillis:       30000,
    max:                     5,       // max 5 connections (safe for free tier)
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
  });

  pool.on('connect', () => {
    console.log('✓ Database connection established');
  });

} catch (err) {
  console.error('Failed to create DB pool:', err.message);
  // Dummy pool — server still starts, all queries fail with a clear message
  pool = {
    query:   async () => { throw new Error('Database not configured. Set DATABASE_URL in Render environment.'); },
    connect: async () => { throw new Error('Database not configured.'); },
  };
}

// ── Create all tables if they do not exist ────────────────────────────────────
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.error('Skipping DB init — DATABASE_URL not set');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    console.log('✓ Connected to database, initialising tables...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        credits    INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Charts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS charts (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        dob         DATE NOT NULL,
        birth_time  TEXT NOT NULL,
        birth_place TEXT NOT NULL,
        latitude    NUMERIC(10,6),
        longitude   NUMERIC(10,6),
        chart_data  JSONB NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Chats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
        razorpay_order_id   TEXT,
        razorpay_payment_id TEXT,
        plan                TEXT NOT NULL,
        amount              INTEGER NOT NULL,
        credits_added       INTEGER NOT NULL,
        status              TEXT NOT NULL DEFAULT 'pending',
        created_at          TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✓ All database tables ready');

  } catch (err) {
    console.error('✗ DB init error:', err.message);
    console.error('Check that DATABASE_URL is correct and the database is accessible.');
    console.error('Full error:', err);
  } finally {
    if (client) client.release();
  }
}

module.exports = { pool, initDB };
