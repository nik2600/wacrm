-- Saved Google Sheets import sources for manual re-sync and scheduled sync.
CREATE TABLE IF NOT EXISTS google_sheet_import_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('published_csv', 'private_sheet')),
  published_url TEXT,
  spreadsheet_id TEXT,
  sheet_range TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      source_type = 'published_csv'
      AND published_url IS NOT NULL
      AND spreadsheet_id IS NULL
    )
    OR (
      source_type = 'private_sheet'
      AND spreadsheet_id IS NOT NULL
      AND published_url IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_google_sheet_import_sources_user
  ON google_sheet_import_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_google_sheet_import_sources_active
  ON google_sheet_import_sources(is_active);

ALTER TABLE google_sheet_import_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sheet import sources"
  ON google_sheet_import_sources;
CREATE POLICY "Users can manage own sheet import sources"
  ON google_sheet_import_sources FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON google_sheet_import_sources;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON google_sheet_import_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
