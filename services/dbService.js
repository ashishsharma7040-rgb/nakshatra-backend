// services/dbService.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set.');
}

let pool;
try {
  pool = new Pool({
    connectionString:        process.env.DATABASE_URL,
    // IMPORTANT: Supabase requires SSL but has a self-signed cert chain.
    // We must set rejectUnauthorized: false AND pass the ssl object
    // directly in connectionString format won't work — must use this object form.
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined, // skip hostname check
    },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis:       30000,
    max:                     5,
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
  });

  pool.on('connect', () => {
    console.log('✓ DB client connected');
  });

} catch (err) {
  console.error('Failed to create DB pool:', err.message);
  pool = {
    query:   async () => { throw new Error('Database not configured. Set DATABASE_URL on Render.'); },
    connect: async () => { throw new Error('Database not configured.'); },
  };
}

async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.error('Skipping DB init — DATABASE_URL not set');
    return;
  }
  let client;
  try {
    client = await pool.connect();
    console.log('✓ Connected to database, checking tables...');

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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
  } finally {
    if (client) client.release();
  }
}

module.exports = { pool, initDB };
