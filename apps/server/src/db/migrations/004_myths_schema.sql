-- Migration: 004_myths_schema.sql
-- Creates tables for the Emergent Mythology System

-- Myth event types
CREATE TYPE myth_event_type AS ENUM (
  'great_battle',      -- Large battle with 100+ casualties
  'divine_intervention', -- Powerful miracle cast
  'hero_death',        -- Champion death in battle
  'city_founding',     -- New territory claimed/city built
  'betrayal',          -- Alliance broken or treachery
  'siege_victory',     -- Successful siege completion
  'dominance_achieved', -- Faction achieved dominance
  'miracle_smite'      -- Smite miracle used
);

-- Main myths table
CREATE TABLE IF NOT EXISTS myths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id UUID NOT NULL REFERENCES shards(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  event_type myth_event_type NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  generated_text TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  tick_created INTEGER NOT NULL,
  is_notable BOOLEAN DEFAULT FALSE,  -- Marks particularly significant myths
  views INTEGER DEFAULT 0,           -- Track how many times viewed
  shares INTEGER DEFAULT 0,          -- Track external shares
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient faction myth queries
CREATE INDEX IF NOT EXISTS idx_myths_faction ON myths(faction_id);
CREATE INDEX IF NOT EXISTS idx_myths_shard ON myths(shard_id);
CREATE INDEX IF NOT EXISTS idx_myths_event_type ON myths(event_type);
CREATE INDEX IF NOT EXISTS idx_myths_notable ON myths(is_notable) WHERE is_notable = TRUE;
CREATE INDEX IF NOT EXISTS idx_myths_created ON myths(created_at DESC);

-- Myth templates table (for admin configuration)
CREATE TABLE IF NOT EXISTS myth_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type myth_event_type NOT NULL,
  template_text TEXT NOT NULL,      -- Template with {placeholders}
  title_template VARCHAR(200) NOT NULL,
  weight INTEGER DEFAULT 1,          -- Higher weight = more likely to be selected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial myth templates
INSERT INTO myth_templates (event_type, template_text, title_template, weight) VALUES
-- Great Battle templates
('great_battle', 'In the {adjective} fields of {location}, the armies of {faction} clashed against {enemy_faction}. {casualty_count} souls were claimed by the gods that day, and the land was forever changed by the {battle_outcome}.', 'The {adjective} Battle of {location}', 2),
('great_battle', 'When {faction} met {enemy_faction} upon the {terrain} of {location}, the heavens themselves trembled. The {victor} emerged triumphant, though {casualty_count} warriors would never see another dawn.', 'The Clash at {location}', 2),
('great_battle', 'Legend speaks of the day when {casualty_count} brave warriors fell at {location}. The {faction} and {enemy_faction} fought until the very earth ran red, and only the {victor} remained standing.', 'The Blood of {location}', 1),

-- Divine Intervention templates
('divine_intervention', 'The deity of {faction} reached down from the heavens and bestowed {miracle_name} upon {location}. The {affected_element} was transformed, and the faithful knew their prayers had been answered.', 'The Divine {miracle_name}', 2),
('divine_intervention', 'When all seemed lost at {location}, the sky itself parted and {miracle_name} descended upon the land. The people of {faction} fell to their knees in reverence.', 'The Miracle of {location}', 2),
('divine_intervention', 'It is said that on the {tick}th cycle, the god of {faction} manifested {miracle_name} at {location}, forever marking this place as sacred ground.', 'Sacred Ground of {location}', 1),

-- Hero Death templates
('hero_death', 'The great {hero_name} of {faction} fell in glorious battle at {location}. Though {hero_title} breathed their last, their legend shall echo through eternity.', 'The Fall of {hero_name}', 2),
('hero_death', 'At {location}, the {adjective} {hero_name} made their final stand. {hero_title} of {faction} gave their life so that others might live.', 'The Last Stand of {hero_name}', 2),
('hero_death', 'The songs still tell of {hero_name}, {hero_title} of {faction}, who met their end at {location}. Their {notable_deed} shall never be forgotten.', 'The Legend of {hero_name}', 1),

-- City Founding templates
('city_founding', 'In the {adjective} lands of {location}, the people of {faction} laid the first stones of a new settlement. From this humble beginning, greatness would rise.', 'The Founding of {location}', 2),
('city_founding', 'When the scouts of {faction} discovered {location}, they knew the gods had blessed them. Here, they declared, would rise a beacon of civilization.', 'The Discovery of {location}', 2),
('city_founding', 'The {faction} claimed {location} as their own, planting their banner in the {terrain}. A new chapter in their history had begun.', 'The Claiming of {location}', 1),

-- Betrayal templates
('betrayal', 'The alliance between {faction} and {betrayed_faction} was shattered when treachery darkened the hearts of {betrayer}. Trust, once broken, can never be fully restored.', 'The {adjective} Betrayal', 2),
('betrayal', 'In the {tick}th cycle, {faction} turned against {betrayed_faction}, breaking the sacred bonds of alliance. The gods themselves wept at such dishonor.', 'The Breaking of Oaths', 2),
('betrayal', 'When {faction} betrayed {betrayed_faction}, the world learned that even the mightiest alliances can crumble. {consequence} would be their legacy.', 'The Treachery of {faction}', 1),

-- Siege Victory templates
('siege_victory', 'After {siege_duration} days of siege, the walls of {location} finally fell to {faction}. The {defender_faction} could only watch as their stronghold became legend.', 'The Fall of {location}', 2),
('siege_victory', 'The siege of {location} is remembered as one of the greatest military achievements of {faction}. For {siege_duration} days, they pressed their advantage until victory was theirs.', 'The Siege of {location}', 2),
('siege_victory', 'When {faction} breached the defenses of {location}, it marked the end of {defender_faction}''s dominion. A new era had dawned.', 'The Conquest of {location}', 1),

-- Dominance Achieved templates
('dominance_achieved', 'The {faction} rose above all others, commanding {territory_percent}% of the known world. Their dominion cast a shadow across the land.', 'The {adjective} Dominion', 2),
('dominance_achieved', 'In the {tick}th cycle, {faction} achieved what none thought possible - dominance over the realm. {territory_count} territories bowed to their will.', 'The Age of {faction}', 2),

-- Miracle Smite templates
('miracle_smite', 'Divine wrath fell upon {location} when the god of {faction} unleashed {miracle_name} against {enemy_faction}. {casualty_count} were struck down by holy fire.', 'The Divine Judgment at {location}', 2),
('miracle_smite', 'The armies of {enemy_faction} learned to fear the gods when {miracle_name} descended upon them at {location}. {casualty_count} paid the ultimate price.', 'The Smiting of {enemy_faction}', 2);

-- Comments
COMMENT ON TABLE myths IS 'Stores generated myths/lore for factions based on significant events';
COMMENT ON TABLE myth_templates IS 'Templates used for generating myth text with variable substitution';
