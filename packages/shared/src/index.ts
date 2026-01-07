// Shared types, constants, and formulas for Pantheon

// Game constants
export const TICK_RATE_MS = 1000; // World tick rate
export const SIEGE_DURATION_HOURS = 24; // Minimum siege time
export const SEASON_DURATION_DAYS = 60; // ~2 months

// Resource types
export type ResourceType = 'food' | 'production' | 'gold' | 'faith';

// Faction types
export interface Faction {
  id: string;
  name: string;
  deityId: string;
  color: string;
}

// Territory types
export interface Territory {
  id: string;
  x: number;
  y: number;
  ownerId: string | null;
  population: number;
  resources: Record<ResourceType, number>;
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
