/**
 * Event Log System for Pantheon
 * Records all game events for replay and historical analysis
 */

import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import {
  GameState,
  GameEvent,
  GameEventType,
  EventEntityType,
  EventBatch,
  EVENT_LOG_BATCH_SIZE,
  EVENT_LOG_BATCH_TICKS,
} from '@pantheon/shared';
import { eventLogRepo, eventBatchRepo, replayArchiveRepo } from '../db/repositories.js';
import { DbEventLogInsert, DbEventBatchInsert } from '../db/types.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// In-memory event buffer for batching
let eventBuffer: DbEventLogInsert[] = [];
let lastBatchTick = 0;

// Statistics tracking
let totalEventsRecorded = 0;
let totalBytesUncompressed = 0;
let totalBytesCompressed = 0;

/**
 * Record a game event
 */
export async function recordEvent(
  shardId: string,
  tick: number,
  eventType: GameEventType,
  options: {
    subjectType?: EventEntityType;
    subjectId?: string;
    targetType?: EventEntityType;
    targetId?: string;
    data?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const event: DbEventLogInsert = {
    shard_id: shardId,
    tick,
    event_type: eventType,
    subject_type: options.subjectType || null,
    subject_id: options.subjectId || null,
    target_type: options.targetType || null,
    target_id: options.targetId || null,
    data: options.data || {},
  };

  eventBuffer.push(event);
  totalEventsRecorded++;

  // Check if we should flush the buffer
  if (eventBuffer.length >= EVENT_LOG_BATCH_SIZE) {
    await flushEventBuffer(shardId);
  }
}

/**
 * Flush the event buffer to the database
 */
async function flushEventBuffer(shardId: string): Promise<void> {
  if (eventBuffer.length === 0) return;

  try {
    await eventLogRepo.batchCreate(eventBuffer);
    console.log(`[EventLog] Flushed ${eventBuffer.length} events to database`);
    eventBuffer = [];
  } catch (error) {
    console.error('[EventLog] Failed to flush event buffer:', error);
  }
}

/**
 * Process event tick - called periodically to manage batching and compression
 */
export async function processEventTick(state: GameState): Promise<void> {
  if (!state.shardId) return;

  // Flush any pending events
  if (eventBuffer.length > 0) {
    await flushEventBuffer(state.shardId);
  }

  // Check if we should create a compressed batch
  if (state.tick - lastBatchTick >= EVENT_LOG_BATCH_TICKS) {
    await createEventBatch(state.shardId, lastBatchTick, state.tick);
    lastBatchTick = state.tick;
  }
}

/**
 * Create a compressed event batch
 */
async function createEventBatch(
  shardId: string,
  startTick: number,
  endTick: number
): Promise<void> {
  try {
    // Get events in range
    const events = await eventLogRepo.getByTickRange(shardId, startTick, endTick);
    if (events.length === 0) return;

    // Serialize to JSON
    const jsonData = JSON.stringify(events);
    const uncompressedSize = Buffer.byteLength(jsonData, 'utf8');

    // Compress with gzip
    const compressedData = await gzipAsync(Buffer.from(jsonData, 'utf8'));
    const compressedSize = compressedData.length;
    const compressionRatio = Math.round((1 - compressedSize / uncompressedSize) * 100);

    // Create batch record
    const batch: DbEventBatchInsert = {
      shard_id: shardId,
      start_tick: startTick,
      end_tick: endTick,
      event_count: events.length,
      compressed_data: compressedData,
      uncompressed_size: uncompressedSize,
      compressed_size: compressedSize,
      compression_ratio: compressionRatio,
    };

    await eventBatchRepo.create(batch);

    // Update statistics
    totalBytesUncompressed += uncompressedSize;
    totalBytesCompressed += compressedSize;

    console.log(
      `[EventLog] Created batch: ${events.length} events, ` +
      `${formatBytes(uncompressedSize)} -> ${formatBytes(compressedSize)} (${compressionRatio}% reduction)`
    );

    // Clean up raw events that have been batched
    const deletedCount = await eventLogRepo.deleteBeforeTick(shardId, endTick);
    console.log(`[EventLog] Cleaned up ${deletedCount} raw events after batching`);
  } catch (error) {
    console.error('[EventLog] Failed to create event batch:', error);
  }
}

/**
 * Decompress an event batch
 */
export async function decompressEventBatch(compressedData: Buffer): Promise<GameEvent[]> {
  try {
    const decompressed = await gunzipAsync(compressedData);
    const jsonData = decompressed.toString('utf8');
    return JSON.parse(jsonData);
  } catch (error) {
    console.error('[EventLog] Failed to decompress batch:', error);
    return [];
  }
}

/**
 * Get events for a tick range (for replay)
 * Combines batched and unbatched events
 */
export async function getEventsInRange(
  shardId: string,
  startTick: number,
  endTick: number
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];

  try {
    // Get compressed batches
    const batches = await eventBatchRepo.getByTickRange(shardId, startTick, endTick);
    for (const batch of batches) {
      const batchEvents = await decompressEventBatch(batch.compressed_data);
      // Filter to only events in the requested range
      events.push(...batchEvents.filter(e => e.tick >= startTick && e.tick <= endTick));
    }

    // Get any unbatched events
    const rawEvents = await eventLogRepo.getByTickRange(shardId, startTick, endTick);
    for (const dbEvent of rawEvents) {
      events.push({
        id: dbEvent.id,
        shardId: dbEvent.shard_id,
        tick: dbEvent.tick,
        eventType: dbEvent.event_type,
        subjectType: dbEvent.subject_type ?? undefined,
        subjectId: dbEvent.subject_id ?? undefined,
        targetType: dbEvent.target_type ?? undefined,
        targetId: dbEvent.target_id ?? undefined,
        data: dbEvent.data,
        createdAt: new Date(dbEvent.created_at).getTime(),
      });
    }

    // Sort by tick then by creation time
    events.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.createdAt - b.createdAt;
    });

    return events;
  } catch (error) {
    console.error('[EventLog] Failed to get events in range:', error);
    return [];
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(shardId: string): Promise<{
  totalEvents: number;
  totalBatches: number;
  uncompressedBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  estimatedPerTick: number;
  estimatedPerHour: number;
  estimatedPerDay: number;
  estimatedPerSeason: number;
}> {
  try {
    const eventCount = await eventLogRepo.getCount(shardId);
    const batches = await eventBatchRepo.getByShard(shardId);
    const sizes = await eventBatchRepo.getTotalSize(shardId);

    const totalBatches = batches.length;
    const totalEvents = eventCount + batches.reduce((sum, b) => sum + b.event_count, 0);

    const compressionRatio = sizes.uncompressed > 0
      ? Math.round((1 - sizes.compressed / sizes.uncompressed) * 100)
      : 0;

    // Calculate estimates
    const latestTick = await eventLogRepo.getLatestTick(shardId);
    const eventsPerTick = latestTick > 0 ? totalEvents / latestTick : 0;
    const bytesPerEvent = totalEvents > 0 ? sizes.compressed / totalEvents : 100; // estimate 100 bytes if no data

    const estimatedPerTick = Math.round(eventsPerTick * bytesPerEvent);
    const estimatedPerHour = estimatedPerTick * 3600;
    const estimatedPerDay = estimatedPerHour * 24;
    const estimatedPerSeason = estimatedPerDay * 60; // 60 day season

    return {
      totalEvents,
      totalBatches,
      uncompressedBytes: sizes.uncompressed,
      compressedBytes: sizes.compressed,
      compressionRatio,
      estimatedPerTick,
      estimatedPerHour,
      estimatedPerDay,
      estimatedPerSeason,
    };
  } catch (error) {
    console.error('[EventLog] Failed to get storage stats:', error);
    return {
      totalEvents: 0,
      totalBatches: 0,
      uncompressedBytes: 0,
      compressedBytes: 0,
      compressionRatio: 0,
      estimatedPerTick: 0,
      estimatedPerHour: 0,
      estimatedPerDay: 0,
      estimatedPerSeason: 0,
    };
  }
}

/**
 * Helper functions for recording common events
 */
export const EventRecorder = {
  async territoryCapture(
    shardId: string,
    tick: number,
    attackerId: string,
    defenderId: string | null,
    territoryId: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'territory_captured', {
      subjectType: 'faction',
      subjectId: attackerId,
      targetType: 'territory',
      targetId: territoryId,
      data: { defenderId, capturedAt: tick },
    });
  },

  async siegeStarted(
    shardId: string,
    tick: number,
    siegeId: string,
    attackerId: string,
    territoryId: string,
    defenderStrength: number,
    attackerStrength: number
  ): Promise<void> {
    await recordEvent(shardId, tick, 'siege_started', {
      subjectType: 'faction',
      subjectId: attackerId,
      targetType: 'territory',
      targetId: territoryId,
      data: { siegeId, defenderStrength, attackerStrength },
    });
  },

  async siegeCompleted(
    shardId: string,
    tick: number,
    siegeId: string,
    attackerId: string,
    territoryId: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'siege_completed', {
      subjectType: 'siege',
      subjectId: siegeId,
      targetType: 'territory',
      targetId: territoryId,
      data: { attackerId, completedAt: tick },
    });
  },

  async miracleCast(
    shardId: string,
    tick: number,
    factionId: string,
    miracleId: string,
    targetId: string,
    cost: number
  ): Promise<void> {
    await recordEvent(shardId, tick, 'miracle_cast', {
      subjectType: 'faction',
      subjectId: factionId,
      targetType: 'territory',
      targetId: targetId,
      data: { miracleId, cost },
    });
  },

  async warDeclared(
    shardId: string,
    tick: number,
    attackerId: string,
    targetId: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'war_declared', {
      subjectType: 'faction',
      subjectId: attackerId,
      targetType: 'faction',
      targetId: targetId,
      data: {},
    });
  },

  async allianceFormed(
    shardId: string,
    tick: number,
    factionA: string,
    factionB: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'alliance_formed', {
      subjectType: 'faction',
      subjectId: factionA,
      targetType: 'faction',
      targetId: factionB,
      data: {},
    });
  },

  async championSpawned(
    shardId: string,
    tick: number,
    championId: string,
    factionId: string,
    territoryId: string,
    name: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'champion_spawned', {
      subjectType: 'champion',
      subjectId: championId,
      targetType: 'faction',
      targetId: factionId,
      data: { territoryId, name },
    });
  },

  async championDied(
    shardId: string,
    tick: number,
    championId: string,
    factionId: string,
    cause: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'champion_died', {
      subjectType: 'champion',
      subjectId: championId,
      targetType: 'faction',
      targetId: factionId,
      data: { cause },
    });
  },

  async mythCreated(
    shardId: string,
    tick: number,
    mythId: string,
    factionId: string,
    eventType: string,
    title: string
  ): Promise<void> {
    await recordEvent(shardId, tick, 'myth_created', {
      subjectType: 'myth',
      subjectId: mythId,
      targetType: 'faction',
      targetId: factionId,
      data: { eventType, title },
    });
  },

  async seasonEnded(
    shardId: string,
    tick: number,
    seasonId: string,
    winnerId: string | undefined,
    victoryType: string | undefined
  ): Promise<void> {
    await recordEvent(shardId, tick, 'season_ended', {
      subjectType: 'season',
      subjectId: seasonId,
      data: { winnerId, victoryType },
    });
  },
};

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get global statistics (for logging)
 */
export function getGlobalStats(): {
  totalEventsRecorded: number;
  totalBytesUncompressed: number;
  totalBytesCompressed: number;
  bufferSize: number;
} {
  return {
    totalEventsRecorded,
    totalBytesUncompressed,
    totalBytesCompressed,
    bufferSize: eventBuffer.length,
  };
}

/**
 * Initialize the event log system
 */
export function initEventLog(startTick: number): void {
  lastBatchTick = startTick;
  console.log(`[EventLog] Initialized at tick ${startTick}`);
}

/**
 * Shutdown - flush all pending events
 */
export async function shutdownEventLog(shardId: string): Promise<void> {
  if (eventBuffer.length > 0) {
    await flushEventBuffer(shardId);
  }
  console.log('[EventLog] Shutdown complete');
}
