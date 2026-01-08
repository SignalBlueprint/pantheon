-- Event Log Schema for Pantheon
-- Records all game events for replay and archiving

-- Event type enum
CREATE TYPE game_event_type AS ENUM (
  'tick_start',
  'territory_claimed',
  'territory_lost',
  'territory_captured',
  'faction_created',
  'faction_eliminated',
  'siege_started',
  'siege_progress',
  'siege_completed',
  'siege_broken',
  'siege_abandoned',
  'battle_started',
  'battle_resolved',
  'miracle_cast',
  'miracle_effect_expired',
  'divine_power_changed',
  'resources_changed',
  'population_changed',
  'war_declared',
  'peace_offered',
  'peace_accepted',
  'peace_rejected',
  'alliance_proposed',
  'alliance_formed',
  'alliance_broken',
  'truce_started',
  'truce_ended',
  'champion_spawned',
  'champion_died',
  'champion_blessed',
  'champion_assigned',
  'specialization_unlocked',
  'specialization_chosen',
  'myth_created',
  'dominance_started',
  'dominance_lost',
  'season_started',
  'season_ended',
  'custom'
);

-- Event log table
CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  event_type game_event_type NOT NULL,

  -- Event subject (who/what triggered the event)
  subject_type VARCHAR(50), -- 'faction', 'territory', 'champion', 'siege', etc.
  subject_id UUID,

  -- Event target (what was affected)
  target_type VARCHAR(50),
  target_id UUID,

  -- Event-specific data (JSON for flexibility)
  data JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying and replay
CREATE INDEX idx_event_log_shard_tick ON event_log(shard_id, tick);
CREATE INDEX idx_event_log_shard_type ON event_log(shard_id, event_type);
CREATE INDEX idx_event_log_subject ON event_log(shard_id, subject_type, subject_id);
CREATE INDEX idx_event_log_target ON event_log(shard_id, target_type, target_id);
CREATE INDEX idx_event_log_created ON event_log(created_at);

-- Event batches table for compressed storage
CREATE TABLE event_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  start_tick INTEGER NOT NULL,
  end_tick INTEGER NOT NULL,
  event_count INTEGER NOT NULL,

  -- Compressed event data (gzip JSON)
  compressed_data BYTEA NOT NULL,
  uncompressed_size INTEGER NOT NULL,
  compressed_size INTEGER NOT NULL,
  compression_ratio DECIMAL(5,2),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching batches by tick range
CREATE INDEX idx_event_batches_shard_ticks ON event_batches(shard_id, start_tick, end_tick);

-- Season archives table (if not exists, enhance for replay data)
-- This is for storing complete season replay data after archiving
CREATE TABLE IF NOT EXISTS replay_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,

  -- Archive metadata
  total_ticks INTEGER NOT NULL,
  total_events INTEGER NOT NULL,
  total_batches INTEGER NOT NULL,

  -- Size statistics
  uncompressed_size_bytes BIGINT NOT NULL,
  compressed_size_bytes BIGINT NOT NULL,

  -- Storage location (for external storage like S3)
  storage_type VARCHAR(50) NOT NULL DEFAULT 'database', -- 'database', 's3', 'supabase_storage'
  storage_path TEXT,

  -- Highlights metadata
  highlight_ticks INTEGER[] DEFAULT '{}', -- Array of interesting tick numbers

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'archived', 'deleted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_replay_archives_season ON replay_archives(season_id);
CREATE INDEX idx_replay_archives_shard ON replay_archives(shard_id);

-- Function to get events for a tick range (for replay)
CREATE OR REPLACE FUNCTION get_events_in_range(
  p_shard_id UUID,
  p_start_tick INTEGER,
  p_end_tick INTEGER
) RETURNS TABLE (
  id UUID,
  tick INTEGER,
  event_type game_event_type,
  subject_type VARCHAR(50),
  subject_id UUID,
  target_type VARCHAR(50),
  target_id UUID,
  data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.tick,
    e.event_type,
    e.subject_type,
    e.subject_id,
    e.target_type,
    e.target_id,
    e.data
  FROM event_log e
  WHERE e.shard_id = p_shard_id
    AND e.tick BETWEEN p_start_tick AND p_end_tick
  ORDER BY e.tick, e.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old event logs (after compression)
CREATE OR REPLACE FUNCTION cleanup_old_events(
  p_shard_id UUID,
  p_before_tick INTEGER
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_log
  WHERE shard_id = p_shard_id
    AND tick < p_before_tick;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE event_log IS 'Records all game events for replay and history';
COMMENT ON TABLE event_batches IS 'Compressed batches of events for efficient storage';
COMMENT ON TABLE replay_archives IS 'Metadata for archived season replays';
COMMENT ON COLUMN event_log.data IS 'Event-specific data as JSON (state changes, values, etc.)';
COMMENT ON COLUMN event_batches.compressed_data IS 'Gzip compressed JSON array of events';
