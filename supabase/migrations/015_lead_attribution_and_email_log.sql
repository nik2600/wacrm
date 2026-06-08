-- Lead attribution used by ad/campaign reporting and imports.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS campaign TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS ad_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign);
CREATE INDEX IF NOT EXISTS idx_contacts_platform ON contacts(platform);

-- Idempotency log for reminder nudges and daily digests.
CREATE TABLE IF NOT EXISTS lead_email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  email_kind TEXT NOT NULL CHECK (email_kind IN ('followup_nudge', 'daily_digest')),
  period_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_email_log_once
  ON lead_email_log(user_id, COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'::uuid), email_kind, period_key);

ALTER TABLE lead_email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own lead email log" ON lead_email_log;
CREATE POLICY "Users can view own lead email log"
  ON lead_email_log FOR SELECT USING (auth.uid() = user_id);

-- Refresh PostgREST/Supabase schema cache so API inserts can see the
-- newly added attribution columns immediately after this migration runs.
NOTIFY pgrst, 'reload schema';
