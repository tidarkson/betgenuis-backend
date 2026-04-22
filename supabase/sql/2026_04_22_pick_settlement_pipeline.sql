-- Pick settlement pipeline schema updates

CREATE TABLE IF NOT EXISTS pick_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  api_fixture_id INTEGER,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  competition TEXT,
  pick TEXT NOT NULL,
  market TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  confidence INTEGER,
  risk TEXT,
  reasoning TEXT,
  kickoff_time TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  result TEXT,
  profit_loss DECIMAL(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pick_records_result_check CHECK (result IN ('WIN', 'LOSS', 'VOID') OR result IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pick_records_fixture_market
  ON pick_records(api_fixture_id, market);

CREATE INDEX IF NOT EXISTS idx_pick_records_result_settled
  ON pick_records(result, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_pick_records_fixture_unsettled
  ON pick_records(api_fixture_id)
  WHERE result IS NULL;

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL UNIQUE,
  total_picks INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  voided INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  roi DECIMAL(8,2) NOT NULL DEFAULT 0,
  profit_units DECIMAL(8,2) NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  streak_type TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_period_check CHECK (period IN ('all_time', '7d', '30d'))
);

ALTER TABLE pick_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read settled picks" ON pick_records;
DROP POLICY IF EXISTS "public read kpi snapshots" ON kpi_snapshots;

CREATE POLICY "public read settled picks"
  ON pick_records
  FOR SELECT
  USING (result IS NOT NULL);

CREATE POLICY "public read kpi snapshots"
  ON kpi_snapshots
  FOR SELECT
  USING (true);

INSERT INTO kpi_snapshots (period)
VALUES ('all_time'), ('7d'), ('30d')
ON CONFLICT (period) DO NOTHING;