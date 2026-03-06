-- ╔══════════════════════════════════════════════════════╗
-- ║   NAKSHATRA AI — DATABASE SETUP                     ║
-- ║   Run this in Supabase SQL Editor                   ║
-- ║   https://supabase.com → SQL Editor → New Query     ║
-- ╚══════════════════════════════════════════════════════╝

-- ── Enable UUID extension ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── USERS TABLE ───────────────────────────────────────────────────────────────
-- Stores accounts, passwords, and credit balances

CREATE TABLE IF NOT EXISTS users (
  id                 UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email              VARCHAR(255) UNIQUE NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  name               VARCHAR(255) NOT NULL,
  credits            INTEGER      DEFAULT 0,
  subscription_type  VARCHAR(50)  DEFAULT 'free',  -- 'free' | 'sage'
  subscription_end   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ── CHARTS TABLE ──────────────────────────────────────────────────────────────
-- Stores the calculated birth chart for each user
-- chart_data is JSONB (full planet positions, houses, dashas)

CREATE TABLE IF NOT EXISTS charts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dob          DATE         NOT NULL,
  birth_time   TIME         NOT NULL,
  birth_place  VARCHAR(255) NOT NULL,
  latitude     DECIMAL(10,6) NOT NULL,
  longitude    DECIMAL(10,6) NOT NULL,
  chart_data   JSONB        NOT NULL,  -- full chart object from ephemerisService
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE(user_id)  -- one chart per user
);

CREATE INDEX IF NOT EXISTS idx_charts_user_id ON charts(user_id);


-- ── CHAT LOGS TABLE ───────────────────────────────────────────────────────────
-- Every AI question and answer is saved here

CREATE TABLE IF NOT EXISTS chat_logs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question    TEXT         NOT NULL,
  ai_answer   TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at DESC);


-- ── TRANSACTIONS TABLE ────────────────────────────────────────────────────────
-- Payment history (Razorpay order IDs and status)

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    VARCHAR(255) UNIQUE NOT NULL,  -- Razorpay order ID
  plan        VARCHAR(50)  NOT NULL,         -- 'starter' | 'popular' | 'sage'
  amount      INTEGER      NOT NULL,         -- in paise (₹99 = 9900)
  status      VARCHAR(50)  DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);


-- ── Auto-update updated_at timestamps ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_charts_updated
  BEFORE UPDATE ON charts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Important: our backend uses service_role key which bypasses RLS.
-- This is correct for server-side code.
-- If you ever use the anon key on the client, you'd need these policies.

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;


-- ── Verify tables created ─────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('users', 'charts', 'chat_logs', 'transactions')
ORDER BY table_name;

-- Expected output:
-- chat_logs    | 5
-- charts       | 10
-- transactions | 7
-- users        | 9
