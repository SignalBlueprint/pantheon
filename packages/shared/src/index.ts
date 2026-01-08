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

// Diplomacy constants
export const DIPLOMACY_WAR_COST = 50; // Divine power to declare war
export const DIPLOMACY_PEACE_COST = 20; // Divine power to offer peace
export const DIPLOMACY_ALLIANCE_COST = 30; // Divine power to propose alliance
export const DIPLOMACY_BREAK_ALLIANCE_COST = 40; // Divine power to break alliance
export const DIPLOMACY_REPUTATION_LOSS_BREAK = 20; // Reputation loss for breaking alliance
export const DIPLOMACY_TRUCE_DURATION_TICKS = 3600 * 6; // 6 hours truce after peace
export const DIPLOMACY_ALLIANCE_COOLDOWN_TICKS = 3600 * 24; // 24 hours before new alliance after breaking

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
  reputation: number;   // 0-100, affects diplomatic interactions
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

// Diplomatic relation status
export type RelationStatus = 'neutral' | 'war' | 'alliance' | 'truce';

// Diplomatic proposal types
export type ProposalType = 'alliance' | 'peace' | 'truce';

// Diplomatic relation between two factions
export interface DiplomaticRelation {
  id: string;
  factionA: string;       // faction ID (always < factionB for consistency)
  factionB: string;       // faction ID
  status: RelationStatus;
  sinceTick: number;      // tick when this relation was established
  proposedBy?: string;    // faction ID if there's a pending proposal
  proposalType?: ProposalType;
}

// Diplomatic event types
export type DiplomaticEventType =
  | 'war_declared'
  | 'peace_offered'
  | 'peace_accepted'
  | 'peace_rejected'
  | 'alliance_proposed'
  | 'alliance_formed'
  | 'alliance_broken'
  | 'truce_started'
  | 'truce_ended';

// Diplomatic event for history
export interface DiplomaticEvent {
  id: string;
  eventType: DiplomaticEventType;
  initiatorId: string;    // faction ID
  targetId: string;       // faction ID
  tick: number;
  data?: Record<string, unknown>;
}

// Message types for deity communication
export type DiplomaticMessageType = 'text' | 'proposal' | 'response' | 'system';

// Message between deities
export interface DiplomaticMessage {
  id: string;
  senderId: string;       // faction ID
  receiverId: string;     // faction ID
  messageType: DiplomaticMessageType;
  content: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: number;      // timestamp
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
  | 'alliance_formed'
  | 'alliance_broken'
  | 'peace_accepted'
  | 'peace_rejected'
  | 'truce_started';

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

// Season constants
export const SEASON_DURATION_WEEKS = 8; // Default season duration
export const SEASON_DOMINANCE_THRESHOLD = 0.6; // 60% territory control
export const SEASON_DOMINANCE_HOURS = 48; // Hours of continuous control needed
export const SEASON_DOMINANCE_TICKS = SEASON_DOMINANCE_HOURS * 3600; // In ticks

// Victory types
export type VictoryType = 'dominance' | 'power' | 'survival' | 'time';

// Season status
export type SeasonStatus = 'pending' | 'active' | 'ended' | 'archived';

// Season ranking entry
export interface SeasonRanking {
  factionId: string;
  deityId: string;
  factionName: string;
  rank: number;
  score: number;
  stats: {
    territoriesHeld: number;
    peakTerritories: number;
    warsWon: number;
    warsLost: number;
    divinePowerSpent: number;
    siegesCompleted: number;
  };
}

// Season type
export interface Season {
  id: string;
  shardId: string;
  name: string;
  startedAt: number; // timestamp
  endsAt: number; // timestamp
  status: SeasonStatus;
  winnerId?: string; // faction ID
  winnerDeityId?: string;
  victoryType?: VictoryType;
  finalRankings: SeasonRanking[];
}

// Legacy record for a player's season achievement
export interface Legacy {
  id: string;
  deityId: string;
  seasonId: string;
  factionId?: string;
  factionName: string;
  factionColor?: string;
  rank: number;
  title?: string;
  score: number;
  stats: Record<string, unknown>;
  rewards: string[];
  premiumCurrencyEarned: number;
  createdAt: number;
}

// Reward tiers
export const REWARD_TIERS = {
  first: { title: 'Ascended', currency: 500 },
  second: { title: 'Exalted', currency: 200 },
  third: { title: 'Exalted', currency: 200 },
  topTen: { title: 'Blessed', currency: 50 },
  participation: { title: 'Participant', currency: 10 },
} as const;

// Dominance tracking for continuous territory control
export interface DominanceTracking {
  id: string;
  seasonId: string;
  factionId: string;
  startedAtTick: number;
  territoryPercentage: number;
  isActive: boolean;
}

// GameState - the complete world state
export interface GameState {
  tick: number;
  shardId?: string; // database ID when persisted
  territories: Map<string, Territory>;
  factions: Map<string, Faction>;
  pendingBattles: PendingBattle[];
  sieges: Map<string, Siege>; // keyed by siege ID
  relations: Map<string, DiplomaticRelation>; // keyed by relation ID
}

// Serializable version for JSON transport
export interface SerializedGameState {
  tick: number;
  shardId?: string;
  territories: Record<string, Territory>;
  factions: Record<string, Faction>;
  pendingBattles: PendingBattle[];
  sieges: Record<string, Siege>;
  relations: Record<string, DiplomaticRelation>;
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
  | 'notification'
  | 'declare_war'
  | 'offer_peace'
  | 'propose_alliance'
  | 'break_alliance'
  | 'respond_proposal'
  | 'diplomatic_event'
  | 'send_message'
  | 'relation_update'
  | 'season_update'
  | 'season_end'
  | 'dominance_alert';

export interface GameMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
}
