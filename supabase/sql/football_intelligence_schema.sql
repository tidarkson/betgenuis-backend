-- Football Intelligence PostgreSQL schema + seed data for Supabase
-- Run this in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- COMPETITIONS TABLE
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  country TEXT,
  season TEXT,
  api_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  country TEXT,
  api_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  competition_id UUID REFERENCES competitions(id),
  kickoff_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  home_score INTEGER,
  away_score INTEGER,
  minute INTEGER,
  venue TEXT,
  round TEXT,
  season TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- STREAM LINKS TABLE
CREATE TABLE IF NOT EXISTS stream_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_name TEXT,
  quality TEXT DEFAULT 'HD',
  language TEXT DEFAULT 'English',
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- BLOG POSTS TABLE
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONTENT QUEUE TABLE
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  competition_tag TEXT,
  match_id UUID REFERENCES matches(id),
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CLICK ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  stream_link_id UUID REFERENCES stream_links(id),
  source TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled ON content_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_click_events_match ON click_events(match_id);
CREATE INDEX IF NOT EXISTS idx_click_events_created ON click_events(created_at);

-- ROW LEVEL SECURITY (read-only for public where required)
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read competitions" ON competitions;
DROP POLICY IF EXISTS "public read teams" ON teams;
DROP POLICY IF EXISTS "public read matches" ON matches;
DROP POLICY IF EXISTS "public read active streams" ON stream_links;
DROP POLICY IF EXISTS "public read published posts" ON blog_posts;

CREATE POLICY "public read competitions" ON competitions FOR SELECT USING (true);
CREATE POLICY "public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "public read active streams" ON stream_links FOR SELECT USING (is_active = true);
CREATE POLICY "public read published posts" ON blog_posts FOR SELECT USING (is_published = true);

-- Service role can do everything (used by backend scripts).
-- content_queue and click_events remain private because no public SELECT policy is created.

-- SEED: 5 competitions
INSERT INTO competitions (name, slug, logo_url, country, season, api_id, is_active)
VALUES
  ('Premier League', 'epl', 'https://placehold.co/128x128?text=EPL', 'England', '2025/26', 39, true),
  ('UEFA Champions League', 'ucl', 'https://placehold.co/128x128?text=UCL', 'Europe', '2025/26', 2, true),
  ('La Liga', 'la-liga', 'https://placehold.co/128x128?text=LL', 'Spain', '2025/26', 140, true),
  ('Africa Cup of Nations', 'afcon', 'https://placehold.co/128x128?text=AFCON', 'Africa', '2025', 12, true),
  ('Serie A', 'serie-a', 'https://placehold.co/128x128?text=SA', 'Italy', '2025/26', 135, true)
ON CONFLICT (slug) DO NOTHING;

-- SEED: 20 teams
INSERT INTO teams (name, slug, logo_url, country, api_id)
VALUES
  ('Arsenal', 'arsenal', 'https://placehold.co/128x128?text=ARS', 'England', 42),
  ('Liverpool', 'liverpool', 'https://placehold.co/128x128?text=LIV', 'England', 40),
  ('Manchester City', 'manchester-city', 'https://placehold.co/128x128?text=MCI', 'England', 50),
  ('Chelsea', 'chelsea', 'https://placehold.co/128x128?text=CHE', 'England', 49),
  ('Real Madrid', 'real-madrid', 'https://placehold.co/128x128?text=RMA', 'Spain', 541),
  ('Barcelona', 'barcelona', 'https://placehold.co/128x128?text=BAR', 'Spain', 529),
  ('Atletico Madrid', 'atletico-madrid', 'https://placehold.co/128x128?text=ATM', 'Spain', 530),
  ('Sevilla', 'sevilla', 'https://placehold.co/128x128?text=SEV', 'Spain', 536),
  ('Inter Milan', 'inter-milan', 'https://placehold.co/128x128?text=INT', 'Italy', 505),
  ('AC Milan', 'ac-milan', 'https://placehold.co/128x128?text=ACM', 'Italy', 489),
  ('Juventus', 'juventus', 'https://placehold.co/128x128?text=JUV', 'Italy', 496),
  ('Napoli', 'napoli', 'https://placehold.co/128x128?text=NAP', 'Italy', 492),
  ('Bayern Munich', 'bayern-munich', 'https://placehold.co/128x128?text=BAY', 'Germany', 157),
  ('Paris Saint-Germain', 'paris-saint-germain', 'https://placehold.co/128x128?text=PSG', 'France', 85),
  ('Borussia Dortmund', 'borussia-dortmund', 'https://placehold.co/128x128?text=BVB', 'Germany', 165),
  ('Benfica', 'benfica', 'https://placehold.co/128x128?text=BEN', 'Portugal', 211),
  ('Nigeria', 'nigeria', 'https://placehold.co/128x128?text=NGA', 'Nigeria', 554),
  ('Senegal', 'senegal', 'https://placehold.co/128x128?text=SEN', 'Senegal', 557),
  ('Morocco', 'morocco', 'https://placehold.co/128x128?text=MAR', 'Morocco', 558),
  ('Egypt', 'egypt', 'https://placehold.co/128x128?text=EGY', 'Egypt', 556)
ON CONFLICT (slug) DO NOTHING;

-- QUICK VERIFICATION
-- SELECT COUNT(*) AS competitions_count FROM competitions WHERE slug IN ('epl', 'ucl', 'la-liga', 'afcon', 'serie-a');
-- SELECT COUNT(*) AS teams_count FROM teams;
