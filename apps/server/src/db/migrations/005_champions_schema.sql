-- Champions Schema for Pantheon
-- Mortal champions that emerge from high-population territories

-- Champion type enum
CREATE TYPE champion_type AS ENUM ('general');

-- Champions table
CREATE TABLE champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  type champion_type NOT NULL DEFAULT 'general',
  age INTEGER NOT NULL DEFAULT 0,
  max_lifespan INTEGER NOT NULL DEFAULT 3600, -- ticks (1 hour default lifespan)
  blessed BOOLEAN NOT NULL DEFAULT FALSE,
  blessed_at INTEGER, -- tick when blessed
  stats JSONB NOT NULL DEFAULT '{
    "combat": 10,
    "leadership": 10,
    "loyalty": 100
  }',
  assigned_army_id UUID, -- for future army assignment
  kills INTEGER NOT NULL DEFAULT 0,
  battles_won INTEGER NOT NULL DEFAULT 0,
  battles_fought INTEGER NOT NULL DEFAULT 0,
  is_alive BOOLEAN NOT NULL DEFAULT TRUE,
  death_tick INTEGER,
  death_cause VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at_tick INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_champions_shard ON champions(shard_id);
CREATE INDEX idx_champions_faction ON champions(faction_id);
CREATE INDEX idx_champions_territory ON champions(territory_id);
CREATE INDEX idx_champions_alive ON champions(shard_id, is_alive) WHERE is_alive = TRUE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_champions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER champions_updated_at
  BEFORE UPDATE ON champions
  FOR EACH ROW
  EXECUTE FUNCTION update_champions_updated_at();

-- Champion names table for name generation
CREATE TABLE champion_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_type VARCHAR(20) NOT NULL, -- 'first', 'title', 'epithet'
  culture VARCHAR(50), -- optional culture/faction association
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial champion names
INSERT INTO champion_names (name, name_type, weight) VALUES
-- First names
('Marcus', 'first', 2),
('Gaius', 'first', 2),
('Lucius', 'first', 2),
('Titus', 'first', 1),
('Quintus', 'first', 1),
('Septimus', 'first', 1),
('Maximus', 'first', 2),
('Aurelius', 'first', 2),
('Cassius', 'first', 1),
('Brutus', 'first', 1),
('Helena', 'first', 2),
('Livia', 'first', 1),
('Octavia', 'first', 1),
('Cornelia', 'first', 1),
('Valeria', 'first', 2),
('Aeliana', 'first', 1),
('Darius', 'first', 1),
('Cyrus', 'first', 1),
('Xerxes', 'first', 1),
('Artaxerxes', 'first', 1),
('Leonidas', 'first', 2),
('Alexander', 'first', 2),
('Perseus', 'first', 1),
('Achilles', 'first', 1),
('Hector', 'first', 1),
('Ajax', 'first', 1),
('Theron', 'first', 1),
('Demetrius', 'first', 1),
('Nikolaos', 'first', 1),
('Solon', 'first', 1),

-- Titles
('the Brave', 'title', 2),
('the Bold', 'title', 2),
('the Mighty', 'title', 2),
('the Fierce', 'title', 1),
('the Wise', 'title', 1),
('the Cunning', 'title', 1),
('the Relentless', 'title', 1),
('the Unyielding', 'title', 1),
('the Conqueror', 'title', 1),
('the Defender', 'title', 2),
('the Stalwart', 'title', 1),
('the Iron', 'title', 1),
('the Golden', 'title', 1),
('the Scarred', 'title', 1),
('the Blessed', 'title', 1),

-- Epithets (for notable champions)
('Dragonslayer', 'epithet', 1),
('Shieldbreaker', 'epithet', 1),
('Bloodhammer', 'epithet', 1),
('Stormborn', 'epithet', 1),
('Ironhand', 'epithet', 1),
('Flamebringer', 'epithet', 1),
('Deathless', 'epithet', 1),
('Doomhammer', 'epithet', 1),
('Lionheart', 'epithet', 2),
('Thunderstrike', 'epithet', 1);

-- Comments
COMMENT ON TABLE champions IS 'Mortal champions that provide combat bonuses';
COMMENT ON COLUMN champions.age IS 'Current age in ticks';
COMMENT ON COLUMN champions.max_lifespan IS 'Maximum lifespan in ticks before natural death';
COMMENT ON COLUMN champions.blessed IS 'Whether deity has blessed this champion';
COMMENT ON COLUMN champions.stats IS 'JSON containing combat, leadership, and loyalty stats';
