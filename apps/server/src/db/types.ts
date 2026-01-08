/**
 * Database types for Supabase tables
 * These mirror the SQL schema in migrations/001_initial_schema.sql
 */

import { Policy, ResourceFocus, BuildingType, ActiveEffect } from '@pantheon/shared';

// Shard status enum
export type ShardStatus = 'active' | 'paused' | 'ended' | 'archived';

// Siege status enum
export type SiegeStatus = 'active' | 'completed' | 'broken' | 'abandoned';

// Notification types
export type NotificationType =
  | 'siege_started'
  | 'siege_50'
  | 'siege_90'
  | 'siege_complete'
  | 'territory_lost'
  | 'territory_gained'
  | 'miracle_cast'
  | 'war_declared'
  | 'peace_offered'
  | 'alliance_formed';

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
