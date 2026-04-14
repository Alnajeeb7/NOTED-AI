-- ═══════════════════════════════════════════════════════════════
--  NOTED — Missing Tables & Fixes
--  Run this in: supabase.com → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ─── User Profiles (REQUIRED — this table was missing) ──────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  avatar_url    TEXT,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON user_profiles FOR ALL
  USING (id = auth.uid());

-- Allow service role to write (for OAuth setup)
CREATE POLICY "Service role full access to profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Allow service role to bypass RLS on pages & workspaces ─────
CREATE POLICY "Service role full access to pages"
  ON pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to workspaces"
  ON workspaces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Enable Realtime for pages ───────────────────────────────────
-- Go to: Database → Replication → add "pages" table to realtime
