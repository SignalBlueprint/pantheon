-- Pantheon Database Schema
-- Migration: 002_diplomacy_schema
-- Created: 2026-01-08

-- Relations table: diplomatic relationships between factions
CREATE TABLE IF NOT EXISTS relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  faction_a UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  faction_b UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'neutral' CHECK (status IN ('neutral', 'war', 'alliance', 'truce')),
  since_tick BIGINT NOT NULL DEFAULT 0, -- tick when this relation was established
  proposed_by UUID REFERENCES factions(id), -- for pending proposals
  proposal_type VARCHAR(50) CHECK (proposal_type IN ('alliance', 'peace', 'truce')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure faction_a < faction_b to prevent duplicate relations
  CHECK (faction_a < faction_b),
  UNIQUE(shard_id, faction_a, faction_b)
);

-- Messages table: deity-to-deity communication
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('text', 'proposal', 'response', 'system')),
  content TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- additional context (proposal details, etc.)
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diplomatic events table: history of diplomatic actions
CREATE TABLE IF NOT EXISTS diplomatic_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('war_declared', 'peace_offered', 'peace_accepted', 'peace_rejected', 'alliance_proposed', 'alliance_formed', 'alliance_broken', 'truce_started', 'truce_ended')),
  initiator_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  data JSONB DEFAULT '{}', -- additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_relations_shard ON relations(shard_id);
CREATE INDEX IF NOT EXISTS idx_relations_faction_a ON relations(faction_a);
CREATE INDEX IF NOT EXISTS idx_relations_faction_b ON relations(faction_b);
CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(status);
CREATE INDEX IF NOT EXISTS idx_messages_shard ON messages(shard_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_diplomatic_events_shard ON diplomatic_events(shard_id);
CREATE INDEX IF NOT EXISTS idx_diplomatic_events_tick ON diplomatic_events(tick);

-- Trigger for relations updated_at
CREATE TRIGGER update_relations_updated_at BEFORE UPDATE ON relations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add reputation field to factions for diplomacy
ALTER TABLE factions ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100);
