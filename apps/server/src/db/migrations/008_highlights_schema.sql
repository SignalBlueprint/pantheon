-- Highlights and Community Features Schema
-- Migration for Moonshot Phase 3: Living World Archive

-- Highlights table - stores detected interesting moments
CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  tick INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  score FLOAT NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  -- JSON data for the highlight (factions involved, context, etc.)
  highlight_data JSONB DEFAULT '{}',
  -- Related event IDs
  event_ids UUID[] DEFAULT '{}',
  -- Metrics
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  vote_score INTEGER DEFAULT 0,
  -- Status
  is_featured BOOLEAN DEFAULT FALSE,
  is_eternal_canon BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for highlights
CREATE INDEX IF NOT EXISTS idx_highlights_shard ON highlights(shard_id);
CREATE INDEX IF NOT EXISTS idx_highlights_season ON highlights(season_id);
CREATE INDEX IF NOT EXISTS idx_highlights_score ON highlights(score DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_category ON highlights(category);
CREATE INDEX IF NOT EXISTS idx_highlights_featured ON highlights(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_highlights_eternal ON highlights(is_eternal_canon) WHERE is_eternal_canon = TRUE;
CREATE INDEX IF NOT EXISTS idx_highlights_tick ON highlights(shard_id, tick);

-- Community votes table
CREATE TABLE IF NOT EXISTS highlight_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  deity_id UUID NOT NULL,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(highlight_id, deity_id)
);

-- Index for votes
CREATE INDEX IF NOT EXISTS idx_highlight_votes_highlight ON highlight_votes(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_votes_deity ON highlight_votes(deity_id);

-- Highlight reels table - curated collections of highlights
CREATE TABLE IF NOT EXISTS highlight_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID REFERENCES shards(id) ON DELETE SET NULL,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  -- Array of highlight IDs in order
  highlight_ids UUID[] NOT NULL DEFAULT '{}',
  -- Type: auto (generated), curated (manual), user (player-created)
  reel_type VARCHAR(20) NOT NULL DEFAULT 'auto',
  creator_deity_id UUID,
  -- Metrics
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  -- Status
  is_featured BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for reels
CREATE INDEX IF NOT EXISTS idx_highlight_reels_shard ON highlight_reels(shard_id);
CREATE INDEX IF NOT EXISTS idx_highlight_reels_season ON highlight_reels(season_id);
CREATE INDEX IF NOT EXISTS idx_highlight_reels_featured ON highlight_reels(is_featured) WHERE is_featured = TRUE;

-- Spectator links table - shareable URLs for specific replay moments
CREATE TABLE IF NOT EXISTS spectator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(12) NOT NULL UNIQUE,
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  start_tick INTEGER NOT NULL,
  end_tick INTEGER,
  title VARCHAR(200),
  description TEXT,
  -- Creator
  creator_deity_id UUID,
  -- Metrics
  view_count INTEGER DEFAULT 0,
  -- Expiration (null = never expires)
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for spectator links
CREATE INDEX IF NOT EXISTS idx_spectator_links_code ON spectator_links(code);
CREATE INDEX IF NOT EXISTS idx_spectator_links_shard ON spectator_links(shard_id);

-- Update trigger for highlights
CREATE OR REPLACE FUNCTION update_highlights_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS highlights_updated_at ON highlights;
CREATE TRIGGER highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_highlights_timestamp();

DROP TRIGGER IF EXISTS highlight_reels_updated_at ON highlight_reels;
CREATE TRIGGER highlight_reels_updated_at
  BEFORE UPDATE ON highlight_reels
  FOR EACH ROW
  EXECUTE FUNCTION update_highlights_timestamp();

-- Function to update vote score on highlight
CREATE OR REPLACE FUNCTION update_highlight_vote_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE highlights
    SET vote_score = vote_score + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END
    WHERE id = NEW.highlight_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE highlights
    SET vote_score = vote_score - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE -1 END
    WHERE id = OLD.highlight_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote_type != NEW.vote_type THEN
    UPDATE highlights
    SET vote_score = vote_score + CASE WHEN NEW.vote_type = 'up' THEN 2 ELSE -2 END
    WHERE id = NEW.highlight_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS highlight_votes_score ON highlight_votes;
CREATE TRIGGER highlight_votes_score
  AFTER INSERT OR UPDATE OR DELETE ON highlight_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_highlight_vote_score();

-- Generate a random spectator link code
CREATE OR REPLACE FUNCTION generate_spectator_code()
RETURNS VARCHAR(12) AS $$
DECLARE
  chars VARCHAR(62) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(12) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
