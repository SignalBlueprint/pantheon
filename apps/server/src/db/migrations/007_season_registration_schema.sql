-- Season Registration Schema
-- Allows players to register for upcoming seasons before they start

-- Season registrations table
CREATE TABLE IF NOT EXISTS season_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  deity_id UUID NOT NULL,
  faction_name VARCHAR(100) NOT NULL,
  faction_color VARCHAR(7) NOT NULL DEFAULT '#888888',
  starting_position INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_season_registrations_season ON season_registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_season_registrations_deity ON season_registrations(deity_id);
CREATE INDEX IF NOT EXISTS idx_season_registrations_status ON season_registrations(status);

-- Unique constraint: one registration per deity per season
CREATE UNIQUE INDEX IF NOT EXISTS idx_season_registrations_unique
  ON season_registrations(season_id, deity_id)
  WHERE status != 'cancelled';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_season_registration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS season_registration_timestamp ON season_registrations;
CREATE TRIGGER season_registration_timestamp
  BEFORE UPDATE ON season_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_season_registration_timestamp();

-- Add registration_opens_at to seasons table for pre-registration window
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS registration_opens_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 8;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Update seasons status to include 'registration' phase
-- Note: If the status column has a CHECK constraint, we need to drop and recreate it
-- This is safe to run multiple times
DO $$
BEGIN
  -- Try to update the check constraint
  ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_status_check;
  ALTER TABLE seasons ADD CONSTRAINT seasons_status_check
    CHECK (status IN ('registration', 'pending', 'active', 'ended', 'archived'));
EXCEPTION
  WHEN others THEN
    -- Constraint may not exist, which is fine
    NULL;
END $$;

-- Helper function to get registration count for a season
CREATE OR REPLACE FUNCTION get_season_registration_count(p_season_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM season_registrations
    WHERE season_id = p_season_id
    AND status IN ('pending', 'confirmed')
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if registration is open for a season
CREATE OR REPLACE FUNCTION is_registration_open(p_season_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_season seasons%ROWTYPE;
BEGIN
  SELECT * INTO v_season FROM seasons WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Registration is open if:
  -- 1. Status is 'registration' or 'pending'
  -- 2. Current time is after registration_opens_at (if set)
  -- 3. Current time is before started_at
  RETURN (
    v_season.status IN ('registration', 'pending')
    AND (v_season.registration_opens_at IS NULL OR NOW() >= v_season.registration_opens_at)
    AND (v_season.starts_at IS NULL OR NOW() < v_season.starts_at)
  );
END;
$$ LANGUAGE plpgsql;
