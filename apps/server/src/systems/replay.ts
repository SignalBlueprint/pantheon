/**
 * Replay System for Pantheon
 * Reconstructs game state from recorded events for playback
 */

import {
  GameState,
  GameEvent,
  GameEventType,
  Faction,
  Siege,
  createInitialGameState,
} from '@pantheon/shared';
import { getEventsInRange } from './eventlog.js';
import { eventBatchRepo, eventLogRepo } from '../db/repositories.js';

// Replay state
export interface ReplayState {
  shardId: string;
  seasonId?: string;
  startTick: number;
  endTick: number;
  currentTick: number;
  gameState: GameState;
  events: GameEvent[];
  isPlaying: boolean;
  playbackSpeed: number;
}

// Replay metadata
export interface ReplayMetadata {
  shardId: string;
  seasonId?: string;
  startTick: number;
  endTick: number;
  totalEvents: number;
  totalTicks: number;
  compressedSizeBytes: number;
}

// Playback speeds (ticks per second)
export const PLAYBACK_SPEEDS = {
  '1x': 1,
  '10x': 10,
  '100x': 100,
  '1000x': 1000,
} as const;

export type PlaybackSpeed = keyof typeof PLAYBACK_SPEEDS;

/**
 * Load replay metadata for a shard
 */
export async function getReplayMetadata(shardId: string): Promise<ReplayMetadata | null> {
  try {
    // Get latest tick from events
    const latestTick = await eventLogRepo.getLatestTick(shardId);
    if (latestTick === 0) {
      // Check batches
      const batches = await eventBatchRepo.getByShard(shardId);
      if (batches.length === 0) return null;

      const endTick = Math.max(...batches.map(b => b.end_tick));
      const startTick = Math.min(...batches.map(b => b.start_tick));
      const totalEvents = batches.reduce((sum, b) => sum + b.event_count, 0);
      const compressedSize = batches.reduce((sum, b) => sum + b.compressed_size, 0);

      return {
        shardId,
        startTick,
        endTick,
        totalEvents,
        totalTicks: endTick - startTick,
        compressedSizeBytes: compressedSize,
      };
    }

    const eventCount = await eventLogRepo.getCount(shardId);

    return {
      shardId,
      startTick: 0,
      endTick: latestTick,
      totalEvents: eventCount,
      totalTicks: latestTick,
      compressedSizeBytes: 0,
    };
  } catch (error) {
    console.error('[Replay] Failed to get metadata:', error);
    return null;
  }
}

/**
 * Initialize a new replay session
 */
export async function initializeReplay(
  shardId: string,
  startTick: number = 0
): Promise<ReplayState | null> {
  try {
    const metadata = await getReplayMetadata(shardId);
    if (!metadata) {
      console.error('[Replay] No replay data found for shard:', shardId);
      return null;
    }

    // Create initial game state
    const gameState = createInitialGameState();
    gameState.shardId = shardId;
    gameState.tick = startTick;

    // Load events for initial reconstruction
    const events = await getEventsInRange(shardId, 0, metadata.endTick);

    const replayState: ReplayState = {
      shardId,
      startTick: metadata.startTick,
      endTick: metadata.endTick,
      currentTick: startTick,
      gameState,
      events,
      isPlaying: false,
      playbackSpeed: 1,
    };

    // Apply events up to start tick
    applyEventsToTick(replayState, startTick);

    console.log(`[Replay] Initialized replay for shard ${shardId}, ${events.length} events loaded`);

    return replayState;
  } catch (error) {
    console.error('[Replay] Failed to initialize replay:', error);
    return null;
  }
}

/**
 * Apply events up to a specific tick
 */
export function applyEventsToTick(replay: ReplayState, targetTick: number): void {
  // Reset to start if going backwards
  if (targetTick < replay.currentTick) {
    replay.gameState = createInitialGameState();
    replay.gameState.shardId = replay.shardId;
    replay.gameState.tick = 0;
    replay.currentTick = 0;
  }

  // Apply events from current tick to target
  const eventsToApply = replay.events.filter(
    e => e.tick > replay.currentTick && e.tick <= targetTick
  );

  for (const event of eventsToApply) {
    applyEvent(replay.gameState, event);
  }

  replay.currentTick = targetTick;
  replay.gameState.tick = targetTick;
}

/**
 * Apply a single event to the game state
 */
function applyEvent(state: GameState, event: GameEvent): void {
  switch (event.eventType) {
    case 'territory_claimed':
    case 'territory_captured': {
      const territoryId = event.targetId || event.data.territoryId as string;
      const factionId = event.subjectId || event.data.factionId as string;
      if (territoryId && factionId) {
        const territory = state.territories.get(territoryId);
        if (territory) {
          // Remove from old owner
          if (territory.owner) {
            const oldFaction = state.factions.get(territory.owner);
            if (oldFaction) {
              oldFaction.territories = oldFaction.territories.filter(t => t !== territoryId);
            }
          }
          // Add to new owner
          territory.owner = factionId;
          const newFaction = state.factions.get(factionId);
          if (newFaction && !newFaction.territories.includes(territoryId)) {
            newFaction.territories.push(territoryId);
          }
        }
      }
      break;
    }

    case 'faction_created': {
      const factionData = event.data as Partial<Faction>;
      if (event.subjectId && factionData.name) {
        const faction: Faction = {
          id: event.subjectId,
          name: factionData.name || 'Unknown',
          color: factionData.color || '#888888',
          deityId: factionData.deityId || '',
          policies: factionData.policies || { expansion: 50, aggression: 50, resourceFocus: 'balanced' },
          territories: factionData.territories || [],
          resources: factionData.resources || { food: 100, production: 50, gold: 0, faith: 0 },
          divinePower: factionData.divinePower || 100,
          reputation: factionData.reputation || 100,
          specialization: factionData.specialization || null,
          createdAtTick: event.tick,
          specializationUnlockAvailable: false,
        };
        state.factions.set(event.subjectId, faction);
      }
      break;
    }

    case 'faction_eliminated': {
      if (event.subjectId) {
        const faction = state.factions.get(event.subjectId);
        if (faction) {
          // Clear territories
          for (const territoryId of faction.territories) {
            const territory = state.territories.get(territoryId);
            if (territory) {
              territory.owner = null;
            }
          }
          state.factions.delete(event.subjectId);
        }
      }
      break;
    }

    case 'siege_started': {
      const siegeData = event.data as { siegeId: string; defenderStrength: number; attackerStrength: number };
      if (siegeData.siegeId && event.subjectId && event.targetId) {
        const siege: Siege = {
          id: siegeData.siegeId,
          attackerId: event.subjectId,
          territoryId: event.targetId,
          startedAtTick: event.tick,
          progress: 0,
          requiredProgress: 86400, // default
          attackerStrength: siegeData.attackerStrength || 0,
          defenderStrength: siegeData.defenderStrength || 0,
          status: 'active',
        };
        state.sieges.set(siegeData.siegeId, siege);
      }
      break;
    }

    case 'siege_progress': {
      const progressData = event.data as { siegeId: string; progress: number };
      if (progressData.siegeId) {
        const siege = state.sieges.get(progressData.siegeId);
        if (siege) {
          siege.progress = progressData.progress;
        }
      }
      break;
    }

    case 'siege_completed':
    case 'siege_broken':
    case 'siege_abandoned': {
      const siegeData = event.data as { siegeId: string };
      if (siegeData.siegeId || event.subjectId) {
        state.sieges.delete(siegeData.siegeId || event.subjectId!);
      }
      break;
    }

    case 'divine_power_changed': {
      const powerData = event.data as { divinePower: number };
      if (event.subjectId && typeof powerData.divinePower === 'number') {
        const faction = state.factions.get(event.subjectId);
        if (faction) {
          faction.divinePower = powerData.divinePower;
        }
      }
      break;
    }

    case 'resources_changed': {
      const resourceData = event.data as { resources: Faction['resources'] };
      if (event.subjectId && resourceData.resources) {
        const faction = state.factions.get(event.subjectId);
        if (faction) {
          faction.resources = { ...faction.resources, ...resourceData.resources };
        }
      }
      break;
    }

    case 'population_changed': {
      const popData = event.data as { population: number };
      if (event.targetId && typeof popData.population === 'number') {
        const territory = state.territories.get(event.targetId);
        if (territory) {
          territory.population = popData.population;
        }
      }
      break;
    }

    case 'war_declared':
    case 'peace_offered':
    case 'peace_accepted':
    case 'alliance_formed':
    case 'alliance_broken':
    case 'truce_started': {
      // Diplomatic events - relations are tracked separately
      // For replay visualization, we can highlight these moments
      break;
    }

    case 'specialization_chosen': {
      const specData = event.data as { specialization: string };
      if (event.subjectId && specData.specialization) {
        const faction = state.factions.get(event.subjectId);
        if (faction) {
          faction.specialization = specData.specialization as Faction['specialization'];
        }
      }
      break;
    }

    // Many other events are informational and don't change core state
    default:
      // Events like champion_spawned, myth_created, etc. are for the log
      break;
  }
}

/**
 * Advance replay by one tick
 */
export function advanceReplayTick(replay: ReplayState): boolean {
  if (replay.currentTick >= replay.endTick) {
    replay.isPlaying = false;
    return false;
  }

  const nextTick = replay.currentTick + 1;
  applyEventsToTick(replay, nextTick);
  return true;
}

/**
 * Seek to a specific tick
 */
export function seekToTick(replay: ReplayState, tick: number): void {
  const targetTick = Math.max(replay.startTick, Math.min(replay.endTick, tick));
  applyEventsToTick(replay, targetTick);
}

/**
 * Set playback speed
 */
export function setPlaybackSpeed(replay: ReplayState, speed: PlaybackSpeed): void {
  replay.playbackSpeed = PLAYBACK_SPEEDS[speed];
}

/**
 * Get events at a specific tick (for UI highlights)
 */
export function getEventsAtTick(replay: ReplayState, tick: number): GameEvent[] {
  return replay.events.filter(e => e.tick === tick);
}

/**
 * Find interesting moments (for highlight detection)
 */
export function findInterestingMoments(replay: ReplayState): number[] {
  const interestingTicks: number[] = [];

  // Find ticks with significant events
  const significantEvents: GameEventType[] = [
    'territory_captured',
    'faction_eliminated',
    'siege_completed',
    'alliance_formed',
    'alliance_broken',
    'war_declared',
    'champion_died',
    'dominance_started',
    'season_ended',
  ];

  for (const event of replay.events) {
    if (significantEvents.includes(event.eventType)) {
      if (!interestingTicks.includes(event.tick)) {
        interestingTicks.push(event.tick);
      }
    }
  }

  return interestingTicks.sort((a, b) => a - b);
}

/**
 * Get replay progress percentage
 */
export function getReplayProgress(replay: ReplayState): number {
  const totalTicks = replay.endTick - replay.startTick;
  if (totalTicks === 0) return 100;
  const currentProgress = replay.currentTick - replay.startTick;
  return Math.round((currentProgress / totalTicks) * 100);
}

/**
 * Serialize replay state for client
 */
export function serializeReplayState(replay: ReplayState): {
  currentTick: number;
  endTick: number;
  startTick: number;
  isPlaying: boolean;
  playbackSpeed: number;
  progress: number;
  eventCount: number;
  factionCount: number;
  territoryCount: number;
} {
  return {
    currentTick: replay.currentTick,
    endTick: replay.endTick,
    startTick: replay.startTick,
    isPlaying: replay.isPlaying,
    playbackSpeed: replay.playbackSpeed,
    progress: getReplayProgress(replay),
    eventCount: replay.events.length,
    factionCount: replay.gameState.factions.size,
    territoryCount: replay.gameState.territories.size,
  };
}
