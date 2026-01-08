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
  specialization: SpecializationType;  // null until unlocked
  createdAtTick: number;  // tick when faction was created (for unlock tracking)
  specializationUnlockAvailable: boolean;  // true when can choose specialization
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
  | 'truce_started'
  | 'champion_spawned'
  | 'champion_died'
  | 'champion_blessed';

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

// ============== SPECIALIZATION SYSTEM ==============

// Specialization constants
export const SPECIALIZATION_UNLOCK_TICKS = 100; // Survive 100 ticks
export const SPECIALIZATION_UNLOCK_TERRITORIES = 5; // Control 5+ territories

// Specialization types
export type SpecializationType = 'maritime' | 'fortress' | 'plains' | 'nomadic' | null;

// Specialization bonus modifiers
export interface SpecializationBonuses {
  defenseMultiplier?: number;
  populationCapMultiplier?: number;
  movementSpeedMultiplier?: number;
  foodProductionMultiplier?: number;
  productionMultiplier?: number;
  navalCombatBonus?: number;
  miningBonus?: number;
  tradeBonus?: number;
  raidDamageMultiplier?: number;
  canBuildShips?: boolean;
  canSettleIslands?: boolean;
  canRaidWithoutSiege?: boolean;
  useCampsInsteadOfCities?: boolean;
}

// Unique ability definition
export interface SpecializationAbility {
  id: string;
  name: string;
  description: string;
  cost?: number; // Divine power cost if active ability
  cooldownTicks?: number;
  isPassive: boolean;
}

// Specialization definition
export interface Specialization {
  id: SpecializationType;
  name: string;
  description: string;
  icon: string;
  bonuses: SpecializationBonuses;
  abilities: SpecializationAbility[];
  uniqueBuildings: string[];
}

// Four specialization paths
export const SPECIALIZATIONS: Record<Exclude<SpecializationType, null>, Specialization> = {
  maritime: {
    id: 'maritime',
    name: 'Maritime Dominion',
    description: 'Masters of the seas. Coastal territories produce ships, can settle islands, and excel in naval combat.',
    icon: '⚓',
    bonuses: {
      navalCombatBonus: 0.3, // +30% naval combat
      canBuildShips: true,
      canSettleIslands: true,
      tradeBonus: 0.2, // +20% trade income
    },
    abilities: [
      {
        id: 'shipyard',
        name: 'Shipyard',
        description: 'Coastal territories can build ships for naval transport and combat.',
        isPassive: true,
      },
      {
        id: 'naval_assault',
        name: 'Naval Assault',
        description: 'Launch surprise attack from the sea, bypassing coastal defenses.',
        cost: 40,
        cooldownTicks: 3600,
        isPassive: false,
      },
    ],
    uniqueBuildings: ['shipyard', 'lighthouse', 'harbor'],
  },
  fortress: {
    id: 'fortress',
    name: 'Mountain Fortress',
    description: 'Impregnable defenders. Mountain territories have massive defense bonuses and mines produce rare resources.',
    icon: '🏔️',
    bonuses: {
      defenseMultiplier: 1.5, // +50% defense in mountains
      miningBonus: 0.5, // +50% mining output
      productionMultiplier: 1.2, // +20% production
    },
    abilities: [
      {
        id: 'deep_mines',
        name: 'Deep Mines',
        description: 'Mountain territories produce rare resources and extra production.',
        isPassive: true,
      },
      {
        id: 'fortify',
        name: 'Fortify',
        description: 'Instantly increase defense of a territory by 100% for 10 ticks.',
        cost: 35,
        cooldownTicks: 1800,
        isPassive: false,
      },
    ],
    uniqueBuildings: ['mineshaft', 'watchtower', 'mountain_fortress'],
  },
  plains: {
    id: 'plains',
    name: 'Fertile Plains',
    description: 'Agricultural masters. Flat territories support double population and food exports generate gold.',
    icon: '🌾',
    bonuses: {
      populationCapMultiplier: 2.0, // 2x population cap
      foodProductionMultiplier: 1.3, // +30% food production
      tradeBonus: 0.3, // +30% trade from food exports
    },
    abilities: [
      {
        id: 'abundant_harvest',
        name: 'Abundant Harvest',
        description: 'Surplus food automatically converts to gold through trade routes.',
        isPassive: true,
      },
      {
        id: 'grand_feast',
        name: 'Grand Feast',
        description: 'Boost population growth by 200% in all territories for 20 ticks.',
        cost: 45,
        cooldownTicks: 7200,
        isPassive: false,
      },
    ],
    uniqueBuildings: ['granary', 'market', 'irrigation'],
  },
  nomadic: {
    id: 'nomadic',
    name: 'Nomadic Horde',
    description: 'Swift raiders. No permanent cities, armies move at double speed, and can raid without sieges.',
    icon: '🐎',
    bonuses: {
      movementSpeedMultiplier: 2.0, // 2x movement speed
      raidDamageMultiplier: 1.5, // +50% raid damage
      canRaidWithoutSiege: true,
      useCampsInsteadOfCities: true,
    },
    abilities: [
      {
        id: 'swift_raid',
        name: 'Swift Raid',
        description: 'Attack enemy territories without starting a siege, stealing resources instead.',
        isPassive: true,
      },
      {
        id: 'great_migration',
        name: 'Great Migration',
        description: 'Move all armies instantly to any adjacent territory.',
        cost: 50,
        cooldownTicks: 3600,
        isPassive: false,
      },
    ],
    uniqueBuildings: ['camp', 'horse_stable', 'raider_outpost'],
  },
};

// Check if a faction qualifies for specialization unlock
export function canUnlockSpecialization(
  factionCreatedAtTick: number,
  currentTick: number,
  territoryCount: number
): boolean {
  const ticksSurvived = currentTick - factionCreatedAtTick;
  return ticksSurvived >= SPECIALIZATION_UNLOCK_TICKS && territoryCount >= SPECIALIZATION_UNLOCK_TERRITORIES;
}

// ============== MYTHOLOGY SYSTEM ==============

// Myth event types
export type MythEventType =
  | 'great_battle'
  | 'divine_intervention'
  | 'hero_death'
  | 'city_founding'
  | 'betrayal'
  | 'siege_victory'
  | 'dominance_achieved'
  | 'miracle_smite';

// Myth data interface
export interface Myth {
  id: string;
  shardId: string;
  factionId: string;
  eventType: MythEventType;
  eventData: Record<string, unknown>;
  generatedText: string;
  title: string;
  tickCreated: number;
  isNotable: boolean;
  views: number;
  shares: number;
  createdAt: number;
}

// Myth template interface
export interface MythTemplate {
  id: string;
  eventType: MythEventType;
  templateText: string;
  titleTemplate: string;
  weight: number;
}

// Myth trigger thresholds
export const MYTH_BATTLE_CASUALTY_THRESHOLD = 100; // Casualties needed for great battle myth
export const MYTH_DOMINANCE_THRESHOLD = 0.6; // 60% territory for dominance myth

// ============== CHAMPION SYSTEM ==============

// Champion constants
export const CHAMPION_SPAWN_CHANCE = 0.01; // 1% per tick per territory
export const CHAMPION_MIN_POPULATION = 1000; // Minimum territory population for spawn
export const CHAMPION_BASE_LIFESPAN = 3600; // 1 hour in ticks
export const CHAMPION_BLESS_COST = 80; // Divine power cost
export const CHAMPION_BLESS_STAT_BONUS = 0.5; // +50% stats
export const CHAMPION_BLESS_LIFESPAN_BONUS = 0.5; // +50% lifespan
export const CHAMPION_GENERAL_COMBAT_BONUS = 0.25; // +25% combat strength when leading army

// Champion types
export type ChampionType = 'general';

// Champion stats
export interface ChampionStats {
  combat: number;      // Combat effectiveness (affects battle strength)
  leadership: number;  // Leadership ability (affects army morale)
  loyalty: number;     // Loyalty to faction (0-100, affects defection chance)
}

// Death causes
export type ChampionDeathCause = 'old_age' | 'battle' | 'execution' | 'illness' | 'assassination';

// Champion interface
export interface Champion {
  id: string;
  shardId: string;
  factionId: string;
  territoryId: string | null;
  name: string;
  type: ChampionType;
  age: number;           // Current age in ticks
  maxLifespan: number;   // Maximum lifespan in ticks
  blessed: boolean;
  blessedAt?: number;    // Tick when blessed
  stats: ChampionStats;
  assignedArmyId?: string;
  kills: number;
  battlesWon: number;
  battlesFought: number;
  isAlive: boolean;
  deathTick?: number;
  deathCause?: ChampionDeathCause;
  createdAt: number;     // timestamp
  createdAtTick: number;
}

// Champion spawn event
export interface ChampionSpawnEvent {
  championId: string;
  factionId: string;
  territoryId: string;
  name: string;
  type: ChampionType;
  stats: ChampionStats;
}

// Champion death event
export interface ChampionDeathEvent {
  championId: string;
  factionId: string;
  name: string;
  cause: ChampionDeathCause;
  age: number;
  wasBlessed: boolean;
  kills: number;
  battlesWon: number;
}

// ============== EVENT LOG SYSTEM ==============

// Game event types for replay system
export type GameEventType =
  | 'tick_start'
  | 'territory_claimed'
  | 'territory_lost'
  | 'territory_captured'
  | 'faction_created'
  | 'faction_eliminated'
  | 'siege_started'
  | 'siege_progress'
  | 'siege_completed'
  | 'siege_broken'
  | 'siege_abandoned'
  | 'battle_started'
  | 'battle_resolved'
  | 'miracle_cast'
  | 'miracle_effect_expired'
  | 'divine_power_changed'
  | 'resources_changed'
  | 'population_changed'
  | 'war_declared'
  | 'peace_offered'
  | 'peace_accepted'
  | 'peace_rejected'
  | 'alliance_proposed'
  | 'alliance_formed'
  | 'alliance_broken'
  | 'truce_started'
  | 'truce_ended'
  | 'champion_spawned'
  | 'champion_died'
  | 'champion_blessed'
  | 'champion_assigned'
  | 'specialization_unlocked'
  | 'specialization_chosen'
  | 'myth_created'
  | 'dominance_started'
  | 'dominance_lost'
  | 'season_started'
  | 'season_ended'
  | 'custom';

// Subject/target types for events
export type EventEntityType = 'faction' | 'territory' | 'champion' | 'siege' | 'myth' | 'season' | 'army';

// Game event for replay
export interface GameEvent {
  id: string;
  shardId: string;
  tick: number;
  eventType: GameEventType;
  subjectType?: EventEntityType;
  subjectId?: string;
  targetType?: EventEntityType;
  targetId?: string;
  data: Record<string, unknown>;
  createdAt: number;
}

// Event batch for compressed storage
export interface EventBatch {
  id: string;
  shardId: string;
  startTick: number;
  endTick: number;
  eventCount: number;
  compressedData: Uint8Array;
  uncompressedSize: number;
  compressedSize: number;
  compressionRatio: number;
  createdAt: number;
}

// Replay archive metadata
export interface ReplayArchive {
  id: string;
  seasonId: string;
  shardId: string;
  totalTicks: number;
  totalEvents: number;
  totalBatches: number;
  uncompressedSizeBytes: number;
  compressedSizeBytes: number;
  storageType: 'database' | 's3' | 'supabase_storage';
  storagePath?: string;
  highlightTicks: number[];
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;
}

// Event recording config
export const EVENT_LOG_BATCH_SIZE = 1000; // Events per batch before compression
export const EVENT_LOG_BATCH_TICKS = 3600; // Batch every hour of ticks

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
  | 'dominance_alert'
  | 'specialization_available'
  | 'choose_specialization'
  | 'specialization_chosen'
  | 'use_specialization_ability'
  | 'myth_created'
  | 'get_myths'
  | 'myth_shared'
  | 'champion_spawned'
  | 'champion_died'
  | 'champion_blessed'
  | 'bless_champion'
  | 'assign_champion'
  | 'get_champions';

export interface GameMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
}
