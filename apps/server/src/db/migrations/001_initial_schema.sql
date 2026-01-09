-- Pantheon Database Schema
-- Migration: 001_initial_schema
-- Created: 2026-01-08

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shards table: represents individual game worlds
CREATE TABLE IF NOT EXISTS shards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_tick BIGINT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'archived')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Factions table: player/AI controlled factions
CREATE TABLE IF NOT EXISTS factions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  deity_id UUID, -- NULL for AI factions
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL, -- hex color code
  policies JSONB NOT NULL DEFAULT '{"expansion": 50, "aggression": 50, "resourceFocus": "balanced"}',
  divine_power INTEGER DEFAULT 100 CHECK (divine_power >= 0 AND divine_power <= 200),
  resources JSONB NOT NULL DEFAULT '{"food": 100, "production": 50, "gold": 0, "faith": 0}',
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Territories table: hex map tiles
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  q INTEGER NOT NULL, -- axial coordinate
  r INTEGER NOT NULL, -- axial coordinate
  owner_id UUID REFERENCES factions(id) ON DELETE SET NULL,
  population INTEGER DEFAULT 100 CHECK (population >= 0),
  food INTEGER DEFAULT 50 CHECK (food >= 0),
  production INTEGER DEFAULT 25 CHECK (production >= 0),
  buildings JSONB DEFAULT '[]', -- array of building types
  active_effects JSONB DEFAULT '[]', -- array of ActiveEffect objects
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shard_id, q, r) -- each hex can only exist once per shard
);

-- Sieges table: ongoing siege operations
CREATE TABLE IF NOT EXISTS sieges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  attacker_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_tick BIGINT NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0),
  required_progress INTEGER NOT NULL DEFAULT 86400, -- 24 hours in seconds at 1 tick/sec
  attacker_strength INTEGER DEFAULT 100,
  defender_strength INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'broken', 'abandoned')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(territory_id) -- only one siege per territory at a time
);

-- Notifications table: in-game notifications for players
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  deity_id UUID, -- NULL for AI factions
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- siege_started, siege_50, siege_90, siege_complete, territory_lost, etc.
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- additional context data
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_factions_shard ON factions(shard_id);
CREATE INDEX IF NOT EXISTS idx_factions_deity ON factions(deity_id);
CREATE INDEX IF NOT EXISTS idx_territories_shard ON territories(shard_id);
CREATE INDEX IF NOT EXISTS idx_territories_owner ON territories(owner_id);
CREATE INDEX IF NOT EXISTS idx_territories_coords ON territories(shard_id, q, r);
CREATE INDEX IF NOT EXISTS idx_sieges_shard ON sieges(shard_id);
CREATE INDEX IF NOT EXISTS idx_sieges_attacker ON sieges(attacker_id);
CREATE INDEX IF NOT EXISTS idx_sieges_territory ON sieges(territory_id);
CREATE INDEX IF NOT EXISTS idx_sieges_status ON sieges(status);
CREATE INDEX IF NOT EXISTS idx_notifications_faction ON notifications(faction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_deity ON notifications(deity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(deity_id, read) WHERE read = false;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shards_updated_at BEFORE UPDATE ON shards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factions_updated_at BEFORE UPDATE ON factions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_territories_updated_at BEFORE UPDATE ON territories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sieges_updated_at BEFORE UPDATE ON sieges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
