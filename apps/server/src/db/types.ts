/**
 * Database types for Supabase tables
 * These mirror the SQL schema in migrations/001_initial_schema.sql
 */

import { Policy, ResourceFocus, BuildingType, ActiveEffect, RelationStatus, ProposalType, DiplomaticEventType, DiplomaticMessageType, NotificationType } from '@pantheon/shared';

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
