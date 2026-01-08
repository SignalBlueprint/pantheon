// Shared types, constants, and formulas for Pantheon

// Re-export hex coordinate system
export * from './hex.js';

// Re-export miracle system
export * from './miracles.js';

// Game constants
export const TICK_RATE_MS = 1000; // World tick rate
export const SIEGE_DURATION_HOURS = 24; // Minimum siege time
export const SIEGE_TICKS_PER_HOUR = 3600; // Ticks in one hour at 1 tick/sec
export const SIEGE_MIN_PROGRESS = SIEGE_DURATION_HOURS * SIEGE_TICKS_PER_HOUR; // 86400 ticks for undefended
export const SIEGE_DEFENDED_MULTIPLIER = 2; // 2x duration for defended territories
export const SEASON_DURATION_DAYS = 60; // ~2 months

// Divine power constants
export const DIVINE_POWER_START = 100;
export const DIVINE_POWER_MAX = 200;
export const DIVINE_POWER_REGEN_PER_TEMPLE = 1; // +1 per tick per temple

// Resource types
export type ResourceType = 'food' | 'production' | 'gold' | 'faith';
export type ResourceFocus = 'food' | 'production' | 'balanced';

// Policy type - controls faction AI behavior
export interface Policy {
  expansion: number;      // 0-100: how aggressively to expand
  aggression: number;     // 0-100: how likely to attack enemies
  resourceFocus: ResourceFocus; // what resource to prioritize
}

// Active effect on a territory (from miracles)
export interface ActiveEffect {
  id: string;
  miracleId: string;
  expiresTick: number;
  modifier: {
    foodMultiplier?: number;
    productionMultiplier?: number;
    defenseMultiplier?: number;
    isShielded?: boolean;
  };
}

// Building types for territories
export type BuildingType = 'temple' | 'farm' | 'workshop' | 'fortress';

// Territory type - uses axial hex coordinates (q, r)
export interface Territory {
  id: string;
  q: number;              // axial coordinate q
  r: number;              // axial coordinate r
  owner: string | null;   // factionId or null if unclaimed
  population: number;
  food: number;
  production: number;
  buildings: BuildingType[];  // buildings in this territory
  activeEffects: ActiveEffect[];  // active miracle effects
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
  divinePower: number;  // starts at 100, caps at 200
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

// Siege status types
export type SiegeStatus = 'active' | 'completed' | 'broken' | 'abandoned';

// Siege type - long-running territory capture
export interface Siege {
  id: string;
  attackerId: string;     // faction ID
  territoryId: string;
  startedAtTick: number;
  progress: number;       // current progress towards capture
  requiredProgress: number; // total progress needed
  attackerStrength: number;
  defenderStrength: number;
  status: SiegeStatus;
}

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

// Notification type for in-game alerts
export interface Notification {
  id: string;
  factionId: string | null;
  type: NotificationType;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: number; // tick when created
}

// GameState - the complete world state
export interface GameState {
  tick: number;
  shardId?: string; // database ID when persisted
  territories: Map<string, Territory>;
  factions: Map<string, Faction>;
  pendingBattles: PendingBattle[];
  sieges: Map<string, Siege>; // keyed by siege ID
}

// Serializable version for JSON transport
export interface SerializedGameState {
  tick: number;
  shardId?: string;
  territories: Record<string, Territory>;
  factions: Record<string, Faction>;
  pendingBattles: PendingBattle[];
  sieges: Record<string, Siege>;
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
  | 'cast_miracle'
  | 'miracle_result'
  | 'miracle_cast'
  | 'select_faction'
  | 'policy_change'
  | 'siege_started'
  | 'siege_progress'
  | 'siege_complete'
  | 'siege_broken'
  | 'notification';

export interface GameMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
}
