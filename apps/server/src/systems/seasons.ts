/**
 * Season System for Pantheon
 * Handles seasonal resets, victory conditions, and legacy rewards
 */

import {
  GameState,
  Faction,
  Season,
  SeasonRanking,
  VictoryType,
  SEASON_DURATION_WEEKS,
  SEASON_DOMINANCE_THRESHOLD,
  SEASON_DOMINANCE_TICKS,
  REWARD_TIERS,
} from '@pantheon/shared';
import { v4 as uuidv4 } from 'uuid';
import {
  seasonRepo,
  legacyRepo,
  seasonArchiveRepo,
  dominanceTrackingRepo,
} from '../db/repositories.js';
import {
  DbSeasonInsert,
  DbLegacyInsert,
  DbSeasonArchiveInsert,
  DbDominanceTrackingInsert,
} from '../db/types.js';

// In-memory season state (loaded from DB at startup)
let currentSeason: Season | null = null;

/**
 * Initialize or load the current season for a shard
 */
export async function initializeSeason(state: GameState): Promise<Season | null> {
  if (!state.shardId) return null;

  try {
    // Try to load active season from database
    const dbSeason = await seasonRepo.getActive(state.shardId);

    if (dbSeason) {
      currentSeason = {
        id: dbSeason.id,
        shardId: dbSeason.shard_id,
        name: dbSeason.name,
        startedAt: new Date(dbSeason.started_at).getTime(),
        endsAt: new Date(dbSeason.ends_at).getTime(),
        status: dbSeason.status,
        winnerId: dbSeason.winner_id || undefined,
        winnerDeityId: dbSeason.winner_deity_id || undefined,
        victoryType: dbSeason.victory_type || undefined,
        finalRankings: dbSeason.final_rankings || [],
      };
      console.log(`[Season] Loaded season: ${currentSeason.name}`);
      return currentSeason;
    }

    // No active season - create first season
    return await startNewSeason(state.shardId, 'Season 1');
  } catch (error) {
    console.error('[Season] Failed to initialize season:', error);
    return null;
  }
}

/**
 * Start a new season for a shard
 */
export async function startNewSeason(
  shardId: string,
  name: string,
  durationWeeks: number = SEASON_DURATION_WEEKS
): Promise<Season> {
  const now = Date.now();
  const endsAt = now + durationWeeks * 7 * 24 * 60 * 60 * 1000;

  const dbSeason: DbSeasonInsert = {
    shard_id: shardId,
    name,
    started_at: new Date(now).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    status: 'active',
    winner_id: null,
    winner_deity_id: null,
    victory_type: null,
    final_rankings: [],
  };

  try {
    const created = await seasonRepo.create(dbSeason);

    currentSeason = {
      id: created.id,
      shardId: created.shard_id,
      name: created.name,
      startedAt: new Date(created.started_at).getTime(),
      endsAt: new Date(created.ends_at).getTime(),
      status: created.status,
      finalRankings: [],
    };

    console.log(`[Season] Started new season: ${name} (ends ${new Date(endsAt).toISOString()})`);
    return currentSeason;
  } catch (error) {
    console.error('[Season] Failed to start new season:', error);
    throw error;
  }
}

/**
 * Get the current season
 */
export function getCurrentSeason(): Season | null {
  return currentSeason;
}

/**
 * Get time remaining in the current season (in milliseconds)
 */
export function getTimeRemaining(): number {
  if (!currentSeason) return 0;
  return Math.max(0, currentSeason.endsAt - Date.now());
}

/**
 * Check all victory conditions and return winner if any
 */
export interface VictoryResult {
  hasWinner: boolean;
  winnerId?: string;
  winnerDeityId?: string;
  victoryType?: VictoryType;
}

export function checkVictoryConditions(state: GameState): VictoryResult {
  // Check dominance victory first (most prestigious)
  const dominanceWinner = checkDominanceVictory(state);
  if (dominanceWinner) {
    return {
      hasWinner: true,
      ...dominanceWinner,
      victoryType: 'dominance',
    };
  }

  // Check survival victory (last faction standing)
  const survivalWinner = checkSurvivalVictory(state);
  if (survivalWinner) {
    return {
      hasWinner: true,
      ...survivalWinner,
      victoryType: 'survival',
    };
  }

  // Check time victory (season ended)
  if (currentSeason && Date.now() >= currentSeason.endsAt) {
    const powerWinner = determinePowerVictory(state);
    return {
      hasWinner: true,
      ...powerWinner,
      victoryType: 'time',
    };
  }

  return { hasWinner: false };
}

/**
 * Check for dominance victory (60%+ territories for 48 hours)
 */
function checkDominanceVictory(state: GameState): { winnerId: string; winnerDeityId: string } | null {
  const totalTerritories = state.territories.size;
  if (totalTerritories === 0) return null;

  const threshold = Math.floor(totalTerritories * SEASON_DOMINANCE_THRESHOLD);

  for (const faction of state.factions.values()) {
    if (faction.territories.length >= threshold) {
      // Check if they've held it long enough (tracked separately)
      const dominanceHeld = getDominanceDuration(faction.id, state.tick);
      if (dominanceHeld >= SEASON_DOMINANCE_TICKS) {
        return {
          winnerId: faction.id,
          winnerDeityId: faction.deityId,
        };
      }
    }
  }

  return null;
}

// In-memory dominance tracking (tick when dominance started)
const dominanceStartTicks: Map<string, number> = new Map();

/**
 * Get how long a faction has maintained dominance (in ticks)
 */
function getDominanceDuration(factionId: string, currentTick: number): number {
  const startTick = dominanceStartTicks.get(factionId);
  if (startTick === undefined) return 0;
  return currentTick - startTick;
}

/**
 * Update dominance tracking for all factions
 */
export function updateDominanceTracking(state: GameState): void {
  const totalTerritories = state.territories.size;
  if (totalTerritories === 0) return;

  const threshold = Math.floor(totalTerritories * SEASON_DOMINANCE_THRESHOLD);

  for (const faction of state.factions.values()) {
    const percentage = faction.territories.length / totalTerritories;

    if (faction.territories.length >= threshold) {
      // Faction has dominance
      if (!dominanceStartTicks.has(faction.id)) {
        dominanceStartTicks.set(faction.id, state.tick);
        console.log(`[Season] ${faction.name} achieved dominance (${(percentage * 100).toFixed(1)}%)`);
      }
    } else {
      // Faction lost dominance
      if (dominanceStartTicks.has(faction.id)) {
        dominanceStartTicks.delete(faction.id);
        console.log(`[Season] ${faction.name} lost dominance`);
      }
    }
  }
}

/**
 * Check for survival victory (last faction standing)
 */
function checkSurvivalVictory(state: GameState): { winnerId: string; winnerDeityId: string } | null {
  const aliveFactions = Array.from(state.factions.values()).filter(
    (f) => f.territories.length > 0
  );

  if (aliveFactions.length === 1) {
    const winner = aliveFactions[0];
    return {
      winnerId: winner.id,
      winnerDeityId: winner.deityId,
    };
  }

  return null;
}

/**
 * Determine power victory winner (most accumulated power over season)
 */
function determinePowerVictory(state: GameState): { winnerId: string; winnerDeityId: string } {
  // Use current score as proxy for power
  const rankings = calculateRankings(state);
  const winner = rankings[0];

  return {
    winnerId: winner.factionId,
    winnerDeityId: winner.deityId,
  };
}

/**
 * Calculate rankings for all factions
 */
export function calculateRankings(state: GameState): SeasonRanking[] {
  const rankings: SeasonRanking[] = [];

  for (const faction of state.factions.values()) {
    const score = calculateFactionScore(faction, state);
    rankings.push({
      factionId: faction.id,
      deityId: faction.deityId,
      factionName: faction.name,
      rank: 0, // Will be set after sorting
      score,
      stats: {
        territoriesHeld: faction.territories.length,
        peakTerritories: faction.territories.length, // Would need tracking for actual peak
        warsWon: 0, // Would need tracking
        warsLost: 0,
        divinePowerSpent: 0, // Would need tracking
        siegesCompleted: 0,
      },
    });
  }

  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);

  // Assign ranks
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rankings;
}

/**
 * Calculate a faction's score
 */
function calculateFactionScore(faction: Faction, state: GameState): number {
  let score = 0;

  // Territory count (100 points each)
  score += faction.territories.length * 100;

  // Total population (1 point per 10 population)
  for (const territoryId of faction.territories) {
    const territory = state.territories.get(territoryId);
    if (territory) {
      score += Math.floor(territory.population / 10);
    }
  }

  // Divine power (1 point each)
  score += faction.divinePower;

  // Reputation bonus
  score += faction.reputation * 2;

  return score;
}

/**
 * End the current season with a winner
 */
export async function endSeason(
  state: GameState,
  winnerId: string,
  winnerDeityId: string,
  victoryType: VictoryType
): Promise<void> {
  if (!currentSeason) return;

  console.log(`[Season] Ending season: ${currentSeason.name}`);
  console.log(`[Season] Winner: ${winnerId} (${victoryType} victory)`);

  // Calculate final rankings
  const rankings = calculateRankings(state);

  // Update season in database
  try {
    await seasonRepo.update(currentSeason.id, {
      status: 'ended',
      winner_id: winnerId,
      winner_deity_id: winnerDeityId,
      victory_type: victoryType,
      final_rankings: rankings,
    });

    // Create legacy records and distribute rewards
    await distributeLegacyRewards(currentSeason.id, rankings);

    // Archive final state
    await archiveSeasonState(currentSeason.id, state);

    // Update in-memory state
    currentSeason.status = 'ended';
    currentSeason.winnerId = winnerId;
    currentSeason.winnerDeityId = winnerDeityId;
    currentSeason.victoryType = victoryType;
    currentSeason.finalRankings = rankings;

    console.log(`[Season] Season ended successfully`);
  } catch (error) {
    console.error('[Season] Failed to end season:', error);
  }
}

/**
 * Distribute legacy rewards to all participants
 */
async function distributeLegacyRewards(
  seasonId: string,
  rankings: SeasonRanking[]
): Promise<void> {
  const legacyRecords: DbLegacyInsert[] = [];

  for (const ranking of rankings) {
    let title: string;
    let premiumCurrency: number;

    // Determine reward tier
    if (ranking.rank === 1) {
      title = REWARD_TIERS.first.title;
      premiumCurrency = REWARD_TIERS.first.currency;
    } else if (ranking.rank <= 3) {
      title = REWARD_TIERS.second.title;
      premiumCurrency = REWARD_TIERS.second.currency;
    } else if (ranking.rank <= 10) {
      title = REWARD_TIERS.topTen.title;
      premiumCurrency = REWARD_TIERS.topTen.currency;
    } else {
      title = REWARD_TIERS.participation.title;
      premiumCurrency = REWARD_TIERS.participation.currency;
    }

    legacyRecords.push({
      deity_id: ranking.deityId,
      season_id: seasonId,
      faction_id: ranking.factionId,
      faction_name: ranking.factionName,
      faction_color: null, // Would need to get from faction
      rank: ranking.rank,
      title,
      score: ranking.score,
      stats: ranking.stats,
      rewards: [title.toLowerCase()],
      premium_currency_earned: premiumCurrency,
    });
  }

  try {
    await legacyRepo.batchCreate(legacyRecords);
    console.log(`[Season] Distributed legacy rewards to ${legacyRecords.length} participants`);
  } catch (error) {
    console.error('[Season] Failed to distribute legacy rewards:', error);
  }
}

/**
 * Archive the final state of a season
 */
async function archiveSeasonState(
  seasonId: string,
  state: GameState
): Promise<void> {
  // Serialize territories and factions for archive
  const territories: Record<string, unknown> = {};
  for (const [id, t] of state.territories) {
    territories[id] = t;
  }

  const factions: Record<string, unknown> = {};
  for (const [id, f] of state.factions) {
    factions[id] = f;
  }

  const archive: DbSeasonArchiveInsert = {
    season_id: seasonId,
    archive_type: 'final_state',
    data: {
      tick: state.tick,
      territories,
      factions,
      archivedAt: Date.now(),
    },
  };

  try {
    await seasonArchiveRepo.create(archive);
    console.log(`[Season] Archived final state for season`);
  } catch (error) {
    console.error('[Season] Failed to archive season state:', error);
  }
}

/**
 * Process season tick - check victory conditions
 */
export async function processSeasonTick(state: GameState): Promise<void> {
  if (!currentSeason || currentSeason.status !== 'active') return;

  // Update dominance tracking
  updateDominanceTracking(state);

  // Check for victory every 100 ticks (approximately every ~1.5 minutes)
  if (state.tick % 100 !== 0) return;

  const result = checkVictoryConditions(state);

  if (result.hasWinner && result.winnerId && result.winnerDeityId && result.victoryType) {
    await endSeason(state, result.winnerId, result.winnerDeityId, result.victoryType);
  }
}

/**
 * Get all past winners (Pantheon Hall)
 */
export async function getPantheonHall(limit = 10): Promise<any[]> {
  try {
    const winners = await legacyRepo.getTopRanks(limit);
    return winners;
  } catch (error) {
    console.error('[Season] Failed to get Pantheon Hall:', error);
    return [];
  }
}

/**
 * Get legacy records for a deity
 */
export async function getDeityLegacy(deityId: string): Promise<any[]> {
  try {
    return await legacyRepo.getByDeity(deityId);
  } catch (error) {
    console.error('[Season] Failed to get deity legacy:', error);
    return [];
  }
}
