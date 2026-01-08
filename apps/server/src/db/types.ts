/**
 * Database types for Supabase tables
 * These mirror the SQL schema in migrations/001_initial_schema.sql
 */

import { Policy, ResourceFocus, BuildingType, ActiveEffect, RelationStatus, ProposalType, DiplomaticEventType, DiplomaticMessageType, NotificationType, SpecializationType } from '@pantheon/shared';

// Shard status enum
export type ShardStatus = 'active' | 'paused' | 'ended' | 'archived';

// Siege status enum
export type SiegeStatus = 'active' | 'completed' | 'broken' | 'abandoned';

// Re-export NotificationType from shared to maintain compatibility
export type { NotificationType };

/**
 * Database row for shards table
 */
export interface DbShard {
  id: string;
  name: string;
  created_at: string;
  current_tick: number;
  status: ShardStatus;
  updated_at: string;
}

/**
 * Database row for factions table
 */
export interface DbFaction {
  id: string;
  shard_id: string;
  deity_id: string | null;
  name: string;
  color: string;
  policies: Policy;
  divine_power: number;
  resources: {
    food: number;
    production: number;
    gold: number;
    faith: number;
  };
  is_ai: boolean;
  reputation: number;
  specialization: SpecializationType;
  created_at_tick: number;
  specialization_unlock_available: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for territories table
 */
export interface DbTerritory {
  id: string;
  shard_id: string;
  q: number;
  r: number;
  owner_id: string | null;
  population: number;
  food: number;
  production: number;
  buildings: BuildingType[];
  active_effects: ActiveEffect[];
  created_at: string;
  updated_at: string;
}

/**
 * Database row for sieges table
 */
export interface DbSiege {
  id: string;
  shard_id: string;
  attacker_id: string;
  territory_id: string;
  started_at: string;
  started_tick: number;
  progress: number;
  required_progress: number;
  attacker_strength: number;
  defender_strength: number;
  status: SiegeStatus;
  updated_at: string;
}

/**
 * Database row for notifications table
 */
export interface DbNotification {
  id: string;
  shard_id: string;
  deity_id: string | null;
  faction_id: string | null;
  type: NotificationType;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/**
 * Insert types (without auto-generated fields)
 */
export type DbShardInsert = Omit<DbShard, 'id' | 'created_at' | 'updated_at'>;
export type DbFactionInsert = Omit<DbFaction, 'id' | 'created_at' | 'updated_at'>;
export type DbTerritoryInsert = Omit<DbTerritory, 'id' | 'created_at' | 'updated_at'>;
export type DbSiegeInsert = Omit<DbSiege, 'id' | 'started_at' | 'updated_at'>;
export type DbNotificationInsert = Omit<DbNotification, 'id' | 'created_at'>;

/**
 * Update types (partial, without auto-generated fields)
 */
export type DbShardUpdate = Partial<Omit<DbShard, 'id' | 'created_at' | 'updated_at'>>;
export type DbFactionUpdate = Partial<Omit<DbFaction, 'id' | 'shard_id' | 'created_at' | 'updated_at'>>;
export type DbTerritoryUpdate = Partial<Omit<DbTerritory, 'id' | 'shard_id' | 'created_at' | 'updated_at'>>;
export type DbSiegeUpdate = Partial<Omit<DbSiege, 'id' | 'shard_id' | 'started_at' | 'updated_at'>>;

/**
 * Database row for relations table
 */
export interface DbRelation {
  id: string;
  shard_id: string;
  faction_a: string;
  faction_b: string;
  status: RelationStatus;
  since_tick: number;
  proposed_by: string | null;
  proposal_type: ProposalType | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for messages table
 */
export interface DbMessage {
  id: string;
  shard_id: string;
  sender_id: string;
  receiver_id: string;
  message_type: DiplomaticMessageType;
  content: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/**
 * Database row for diplomatic_events table
 */
export interface DbDiplomaticEvent {
  id: string;
  shard_id: string;
  event_type: DiplomaticEventType;
  initiator_id: string;
  target_id: string;
  tick: number;
  data: Record<string, unknown>;
  created_at: string;
}

// Insert types for new tables
export type DbRelationInsert = Omit<DbRelation, 'id' | 'created_at' | 'updated_at'>;
export type DbMessageInsert = Omit<DbMessage, 'id' | 'created_at'>;
export type DbDiplomaticEventInsert = Omit<DbDiplomaticEvent, 'id' | 'created_at'>;

// Update types for new tables
export type DbRelationUpdate = Partial<Omit<DbRelation, 'id' | 'shard_id' | 'faction_a' | 'faction_b' | 'created_at' | 'updated_at'>>;

// Import season types from shared
import {
  VictoryType,
  SeasonStatus,
  SeasonRanking,
} from '@pantheon/shared';

/**
 * Database row for seasons table
 */
export interface DbSeason {
  id: string;
  shard_id: string;
  name: string;
  started_at: string;
  ends_at: string;
  status: SeasonStatus;
  winner_id: string | null;
  winner_deity_id: string | null;
  victory_type: VictoryType | null;
  final_rankings: SeasonRanking[];
  created_at: string;
  updated_at: string;
}

/**
 * Database row for legacy table
 */
export interface DbLegacy {
  id: string;
  deity_id: string;
  season_id: string;
  faction_id: string | null;
  faction_name: string;
  faction_color: string | null;
  rank: number;
  title: string | null;
  score: number;
  stats: Record<string, unknown>;
  rewards: string[];
  premium_currency_earned: number;
  created_at: string;
}

/**
 * Database row for season_archives table
 */
export interface DbSeasonArchive {
  id: string;
  season_id: string;
  archive_type: 'final_state' | 'highlights' | 'statistics';
  data: Record<string, unknown>;
  created_at: string;
}

/**
 * Database row for dominance_tracking table
 */
export interface DbDominanceTracking {
  id: string;
  season_id: string;
  faction_id: string;
  started_at_tick: number;
  territory_percentage: number;
  is_active: boolean;
  created_at: string;
}

// Insert types for season tables
export type DbSeasonInsert = Omit<DbSeason, 'id' | 'created_at' | 'updated_at'>;
export type DbLegacyInsert = Omit<DbLegacy, 'id' | 'created_at'>;
export type DbSeasonArchiveInsert = Omit<DbSeasonArchive, 'id' | 'created_at'>;
export type DbDominanceTrackingInsert = Omit<DbDominanceTracking, 'id' | 'created_at'>;

// Update types for season tables
export type DbSeasonUpdate = Partial<Omit<DbSeason, 'id' | 'shard_id' | 'created_at' | 'updated_at'>>;
export type DbDominanceTrackingUpdate = Partial<Omit<DbDominanceTracking, 'id' | 'season_id' | 'faction_id' | 'created_at'>>;

// Import myth types from shared
import { MythEventType, ChampionType, ChampionStats, ChampionDeathCause } from '@pantheon/shared';

/**
 * Database row for myths table
 */
export interface DbMyth {
  id: string;
  shard_id: string;
  faction_id: string;
  event_type: MythEventType;
  event_data: Record<string, unknown>;
  generated_text: string;
  title: string;
  tick_created: number;
  is_notable: boolean;
  views: number;
  shares: number;
  created_at: string;
}

/**
 * Database row for myth_templates table
 */
export interface DbMythTemplate {
  id: string;
  event_type: MythEventType;
  template_text: string;
  title_template: string;
  weight: number;
  created_at: string;
}

// Insert types for myth tables
export type DbMythInsert = Omit<DbMyth, 'id' | 'views' | 'shares' | 'created_at'>;
export type DbMythTemplateInsert = Omit<DbMythTemplate, 'id' | 'created_at'>;

// Update types for myth tables
export type DbMythUpdate = Partial<Pick<DbMyth, 'is_notable' | 'views' | 'shares'>>;

/**
 * Database row for champions table
 */
export interface DbChampion {
  id: string;
  shard_id: string;
  faction_id: string;
  territory_id: string | null;
  name: string;
  type: ChampionType;
  age: number;
  max_lifespan: number;
  blessed: boolean;
  blessed_at: number | null;
  stats: ChampionStats;
  assigned_army_id: string | null;
  kills: number;
  battles_won: number;
  battles_fought: number;
  is_alive: boolean;
  death_tick: number | null;
  death_cause: ChampionDeathCause | null;
  created_at: string;
  created_at_tick: number;
  updated_at: string;
}

/**
 * Database row for champion_names table
 */
export interface DbChampionName {
  id: string;
  name: string;
  name_type: 'first' | 'title' | 'epithet';
  culture: string | null;
  weight: number;
  created_at: string;
}

// Insert types for champion tables
export type DbChampionInsert = Omit<DbChampion, 'id' | 'created_at' | 'updated_at'>;
export type DbChampionNameInsert = Omit<DbChampionName, 'id' | 'created_at'>;

// Update types for champion tables
export type DbChampionUpdate = Partial<Omit<DbChampion, 'id' | 'shard_id' | 'faction_id' | 'created_at' | 'created_at_tick' | 'updated_at'>>;

// Import event types from shared
import { GameEventType, EventEntityType } from '@pantheon/shared';

/**
 * Database row for event_log table
 */
export interface DbEventLog {
  id: string;
  shard_id: string;
  tick: number;
  event_type: GameEventType;
  subject_type: EventEntityType | null;
  subject_id: string | null;
  target_type: EventEntityType | null;
  target_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

/**
 * Database row for event_batches table
 */
export interface DbEventBatch {
  id: string;
  shard_id: string;
  start_tick: number;
  end_tick: number;
  event_count: number;
  compressed_data: Buffer;
  uncompressed_size: number;
  compressed_size: number;
  compression_ratio: number;
  created_at: string;
}

/**
 * Database row for replay_archives table
 */
export interface DbReplayArchive {
  id: string;
  season_id: string;
  shard_id: string;
  total_ticks: number;
  total_events: number;
  total_batches: number;
  uncompressed_size_bytes: number;
  compressed_size_bytes: number;
  storage_type: 'database' | 's3' | 'supabase_storage';
  storage_path: string | null;
  highlight_ticks: number[];
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
}

// Insert types for event tables
export type DbEventLogInsert = Omit<DbEventLog, 'id' | 'created_at'>;
export type DbEventBatchInsert = Omit<DbEventBatch, 'id' | 'created_at'>;
export type DbReplayArchiveInsert = Omit<DbReplayArchive, 'id' | 'created_at'>;

// Update types for event tables
export type DbReplayArchiveUpdate = Partial<Pick<DbReplayArchive, 'status' | 'highlight_ticks' | 'storage_path'>>;
