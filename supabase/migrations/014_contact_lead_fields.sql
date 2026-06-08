-- ============================================================
-- CONTACT LEAD FIELDS
-- Every existing contact is also a lead. Defaults ensure contacts
-- created by imports, webhooks, and other existing paths participate
-- in lead workflows without requiring application changes.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS next_followup TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE contacts SET category = 'Joker' WHERE category IS NULL;
UPDATE contacts SET stage = 'DNP' WHERE stage IS NULL;

ALTER TABLE contacts
  ALTER COLUMN category SET DEFAULT 'Joker',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN stage SET DEFAULT 'DNP',
  ALTER COLUMN stage SET NOT NULL;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_category_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_category_check
  CHECK (category IN ('Ace', 'King', 'Queen', 'Joker'));

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_stage_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_stage_check
  CHECK (
    stage IN (
      'DNP',
      'Followup',
      'Meeting Scheduled',
      'Send Proposal',
      'Onboarded',
      'Rejected'
    )
  );

CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup ON contacts(next_followup);

-- Refresh PostgREST/Supabase schema cache so API inserts can see the
-- newly added lead columns immediately after this migration runs.
NOTIFY pgrst, 'reload schema';
