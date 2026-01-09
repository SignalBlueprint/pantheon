-- Pantheon Database Schema
-- Migration: 003_seasons_schema
-- Created: 2026-01-08

-- Seasons table: tracks seasonal resets
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- "Season 1", "Season 2", etc.
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'ended', 'archived')),
  winner_id UUID REFERENCES factions(id), -- winning faction
  winner_deity_id VARCHAR(255), -- winning deity (stored separately for persistence)
  victory_type VARCHAR(50) CHECK (victory_type IN ('dominance', 'power', 'survival', 'time')),
  final_rankings JSONB DEFAULT '[]', -- array of {faction_id, deity_id, rank, score, stats}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shard_id, name)
);

-- Legacy table: permanent record of player achievements across seasons
CREATE TABLE IF NOT EXISTS legacy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deity_id VARCHAR(255) NOT NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  faction_id UUID REFERENCES factions(id),
  faction_name VARCHAR(255) NOT NULL, -- stored for historical reference
  faction_color VARCHAR(50),
  rank INTEGER NOT NULL, -- 1 = winner, 2 = second, etc.
  title VARCHAR(255), -- "Ascended", "Exalted", "Blessed", etc.
  score INTEGER NOT NULL DEFAULT 0,
  stats JSONB DEFAULT '{}', -- detailed stats: territories_held, wars_won, divine_power_spent, etc.
  rewards JSONB DEFAULT '[]', -- array of reward IDs/types earned
  premium_currency_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deity_id, season_id)
);

-- Season archives table: stores historical snapshots of season final states
CREATE TABLE IF NOT EXISTS season_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  archive_type VARCHAR(50) NOT NULL CHECK (archive_type IN ('final_state', 'highlights', 'statistics')),
  data JSONB NOT NULL, -- compressed/serialized game state or stats
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_id, archive_type)
);

-- Dominance tracking table: for tracking 60%+ territory control duration
CREATE TABLE IF NOT EXISTS dominance_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  started_at_tick BIGINT NOT NULL,
  territory_percentage DECIMAL(5, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_id, faction_id, is_active) -- only one active tracking per faction per season
);

-- Add season_id to shards table for linking
ALTER TABLE shards ADD COLUMN IF NOT EXISTS current_season_id UUID REFERENCES seasons(id);

-- Add cumulative stats to factions for season tracking
ALTER TABLE factions ADD COLUMN IF NOT EXISTS season_stats JSONB DEFAULT '{}';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seasons_shard ON seasons(shard_id);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_ends_at ON seasons(ends_at);
CREATE INDEX IF NOT EXISTS idx_legacy_deity ON legacy(deity_id);
CREATE INDEX IF NOT EXISTS idx_legacy_season ON legacy(season_id);
CREATE INDEX IF NOT EXISTS idx_legacy_rank ON legacy(rank);
CREATE INDEX IF NOT EXISTS idx_season_archives_season ON season_archives(season_id);
CREATE INDEX IF NOT EXISTS idx_dominance_tracking_season ON dominance_tracking(season_id);
CREATE INDEX IF NOT EXISTS idx_dominance_tracking_active ON dominance_tracking(is_active) WHERE is_active = true;

-- Trigger for seasons updated_at
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
