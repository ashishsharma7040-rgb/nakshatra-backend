// services/dbService.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        credits     INTEGER NOT NULL DEFAULT 5,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS chats (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

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
    console.log('✓ Database tables ready');
  } catch (err) {
    console.error('✗ DB init error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
