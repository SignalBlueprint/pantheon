// Shared types, constants, and formulas for Pantheon

// Re-export hex coordinate system
export * from './hex.js';

// Game constants
export const TICK_RATE_MS = 1000; // World tick rate
export const SIEGE_DURATION_HOURS = 24; // Minimum siege time
export const SEASON_DURATION_DAYS = 60; // ~2 months

// Resource types
export type ResourceType = 'food' | 'production' | 'gold' | 'faith';
export type ResourceFocus = 'food' | 'production' | 'balanced';

// Policy type - controls faction AI behavior
export interface Policy {
  expansion: number;      // 0-100: how aggressively to expand
  aggression: number;     // 0-100: how likely to attack enemies
  resourceFocus: ResourceFocus; // what resource to prioritize
}

// Territory type - uses axial hex coordinates (q, r)
export interface Territory {
  id: string;
  q: number;              // axial coordinate q
  r: number;              // axial coordinate r
  owner: string | null;   // factionId or null if unclaimed
  population: number;
  food: number;
  production: number;
}

// Faction types
export interface Faction {
  id: string;
  name: string;
  color: string;
  deityId: string;
  policies: Policy;
  territories: string[];  // array of territory IDs
  resources: {
    food: number;
    production: number;
    gold: number;
    faith: number;
  };
}

// Battle type for pending combat resolution
export interface PendingBattle {
  id: string;
  attackerId: string;     // faction ID
  defenderId: string;     // faction ID
  territoryId: string;
  attackerStrength: number;
  defenderStrength: number;
  startedAtTick: number;
}

// GameState - the complete world state
export interface GameState {
  tick: number;
  territories: Map<string, Territory>;
  factions: Map<string, Faction>;
  pendingBattles: PendingBattle[];
}

// Serializable version for JSON transport
export interface SerializedGameState {
  tick: number;
  territories: Record<string, Territory>;
  factions: Record<string, Faction>;
  pendingBattles: PendingBattle[];
}

// Message types for WebSocket communication
export type MessageType =
  | 'connect'
  | 'disconnect'
  | 'world_state'
  | 'territory_update'
  | 'battle_start'
  | 'battle_end'
  | 'miracle'
  | 'policy_change';

export interface GameMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
}
