/**
 * Champion System for Pantheon
 * Handles champion spawning, aging, death, blessing, and combat bonuses
 */

import {
  GameState,
  Faction,
  Territory,
  Champion,
  ChampionType,
  ChampionStats,
  ChampionDeathCause,
  ChampionSpawnEvent,
  ChampionDeathEvent,
  CHAMPION_SPAWN_CHANCE,
  CHAMPION_MIN_POPULATION,
  CHAMPION_BASE_LIFESPAN,
  CHAMPION_BLESS_COST,
  CHAMPION_GENERAL_COMBAT_BONUS,
} from '@pantheon/shared';
import { championRepo, championNameRepo, notificationRepo } from '../db/repositories.js';
import { DbChampionInsert, DbNotificationInsert } from '../db/types.js';
import { generateMyth } from './myths.js';

// Fallback names if database names are not available
const FALLBACK_FIRST_NAMES = [
  'Marcus', 'Gaius', 'Lucius', 'Aurelius', 'Maximus',
  'Helena', 'Livia', 'Cornelia', 'Valeria',
  'Leonidas', 'Alexander', 'Darius', 'Cyrus',
];

const FALLBACK_TITLES = [
  'the Brave', 'the Bold', 'the Mighty', 'the Wise',
  'the Defender', 'the Fierce', 'the Stalwart',
];

// Cache for names
let namesCache: {
  first: { name: string; weight: number }[];
  title: { name: string; weight: number }[];
  epithet: { name: string; weight: number }[];
} | null = null;

/**
 * Load champion names from database into cache
 */
async function loadNames(): Promise<void> {
  if (namesCache) return;

  try {
    const allNames = await championNameRepo.getAll();
    namesCache = {
      first: allNames.filter(n => n.name_type === 'first').map(n => ({ name: n.name, weight: n.weight })),
      title: allNames.filter(n => n.name_type === 'title').map(n => ({ name: n.name, weight: n.weight })),
      epithet: allNames.filter(n => n.name_type === 'epithet').map(n => ({ name: n.name, weight: n.weight })),
    };

    // Use fallbacks if empty
    if (namesCache.first.length === 0) {
      namesCache.first = FALLBACK_FIRST_NAMES.map(n => ({ name: n, weight: 1 }));
    }
    if (namesCache.title.length === 0) {
      namesCache.title = FALLBACK_TITLES.map(n => ({ name: n, weight: 1 }));
    }

    console.log(`[Champions] Loaded ${allNames.length} champion names`);
  } catch (error) {
    console.error('[Champions] Failed to load names:', error);
    // Use fallbacks
    namesCache = {
      first: FALLBACK_FIRST_NAMES.map(n => ({ name: n, weight: 1 })),
      title: FALLBACK_TITLES.map(n => ({ name: n, weight: 1 })),
      epithet: [],
    };
  }
}

/**
 * Select a random name from a weighted list
 */
function selectWeightedRandom(items: { name: string; weight: number }[]): string {
  if (items.length === 0) return 'Unknown';

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.name;
    }
  }
  return items[0].name;
}

/**
 * Generate a champion name
 */
export async function generateChampionName(): Promise<string> {
  await loadNames();

  if (!namesCache) {
    return FALLBACK_FIRST_NAMES[Math.floor(Math.random() * FALLBACK_FIRST_NAMES.length)];
  }

  const firstName = selectWeightedRandom(namesCache.first);

  // 60% chance to add a title
  if (Math.random() < 0.6 && namesCache.title.length > 0) {
    const title = selectWeightedRandom(namesCache.title);
    return `${firstName} ${title}`;
  }

  return firstName;
}

/**
 * Generate random champion stats
 */
function generateStats(): ChampionStats {
  // Base stats with some randomization (8-15 range)
  return {
    combat: 8 + Math.floor(Math.random() * 8),
    leadership: 8 + Math.floor(Math.random() * 8),
    loyalty: 70 + Math.floor(Math.random() * 31), // 70-100
  };
}

/**
 * Calculate lifespan with some randomization
 */
function generateLifespan(): number {
  // Base lifespan ±20%
  const variance = CHAMPION_BASE_LIFESPAN * 0.2;
  return Math.round(CHAMPION_BASE_LIFESPAN + (Math.random() * variance * 2) - variance);
}

/**
 * Spawn a champion in a territory
 */
export async function spawnChampion(
  state: GameState,
  faction: Faction,
  territory: Territory
): Promise<Champion | null> {
  if (!state.shardId) return null;

  const name = await generateChampionName();
  const stats = generateStats();
  const maxLifespan = generateLifespan();

  const championInsert: DbChampionInsert = {
    shard_id: state.shardId,
    faction_id: faction.id,
    territory_id: territory.id,
    name,
    type: 'general' as ChampionType,
    age: 0,
    max_lifespan: maxLifespan,
    blessed: false,
    blessed_at: null,
    stats,
    assigned_army_id: null,
    kills: 0,
    battles_won: 0,
    battles_fought: 0,
    is_alive: true,
    death_tick: null,
    death_cause: null,
    created_at_tick: state.tick,
  };

  try {
    const dbChampion = await championRepo.create(championInsert);

    console.log(`[Champions] ${name} emerged in ${faction.name}'s territory`);

    // Create notification
    const notification: DbNotificationInsert = {
      shard_id: state.shardId,
      deity_id: faction.deityId,
      faction_id: faction.id,
      type: 'champion_spawned',
      message: `A great champion, ${name}, has emerged in your lands!`,
      data: {
        championId: dbChampion.id,
        championName: name,
        territoryId: territory.id,
        stats,
      },
      read: false,
    };
    await notificationRepo.create(notification);

    return dbChampionToChampion(dbChampion);
  } catch (error) {
    console.error('[Champions] Failed to spawn champion:', error);
    return null;
  }
}

/**
 * Process champion spawning for a tick
 * Called during the tick loop
 */
export async function processChampionSpawning(state: GameState): Promise<ChampionSpawnEvent[]> {
  const events: ChampionSpawnEvent[] = [];

  for (const [, faction] of state.factions) {
    // Get territories with sufficient population
    const eligibleTerritories = faction.territories
      .map(tid => state.territories.get(tid))
      .filter((t): t is Territory => t !== undefined && t.population >= CHAMPION_MIN_POPULATION);

    for (const territory of eligibleTerritories) {
      // 1% chance per territory per tick
      if (Math.random() < CHAMPION_SPAWN_CHANCE) {
        const champion = await spawnChampion(state, faction, territory);
        if (champion) {
          events.push({
            championId: champion.id,
            factionId: faction.id,
            territoryId: territory.id,
            name: champion.name,
            type: champion.type,
            stats: champion.stats,
          });
        }
      }
    }
  }

  return events;
}

/**
 * Process champion aging for a tick
 */
export async function processChampionAging(state: GameState): Promise<ChampionDeathEvent[]> {
  if (!state.shardId) return [];

  const deaths: ChampionDeathEvent[] = [];

  try {
    const champions = await championRepo.getByShard(state.shardId, true);

    for (const champion of champions) {
      const newAge = champion.age + 1;

      // Check for natural death
      if (newAge >= champion.max_lifespan) {
        await handleChampionDeath(state, champion.id, 'old_age');
        deaths.push({
          championId: champion.id,
          factionId: champion.faction_id,
          name: champion.name,
          cause: 'old_age',
          age: newAge,
          wasBlessed: champion.blessed,
          kills: champion.kills,
          battlesWon: champion.battles_won,
        });
      } else {
        // Just update age
        await championRepo.update(champion.id, { age: newAge });
      }
    }
  } catch (error) {
    console.error('[Champions] Failed to process aging:', error);
  }

  return deaths;
}

/**
 * Handle champion death
 */
export async function handleChampionDeath(
  state: GameState,
  championId: string,
  cause: ChampionDeathCause
): Promise<void> {
  if (!state.shardId) return;

  try {
    const champion = await championRepo.getById(championId);
    if (!champion || !champion.is_alive) return;

    // Update champion to dead
    await championRepo.kill(championId, state.tick, cause);

    // Get faction for myth generation
    const faction = state.factions.get(champion.faction_id);
    if (!faction) return;

    // Create notification
    const notification: DbNotificationInsert = {
      shard_id: state.shardId,
      deity_id: faction.deityId,
      faction_id: faction.id,
      type: 'champion_died',
      message: `Your champion ${champion.name} has ${cause === 'old_age' ? 'died of old age' : 'fallen'}!`,
      data: {
        championId: champion.id,
        championName: champion.name,
        cause,
        age: champion.age,
        kills: champion.kills,
        battlesWon: champion.battles_won,
        wasBlessed: champion.blessed,
      },
      read: false,
    };
    await notificationRepo.create(notification);

    // Generate death myth
    const eventData = {
      hero_name: champion.name,
      faction: faction.name,
      location: champion.territory_id ? `Territory ${champion.territory_id}` : 'the battlefield',
      cause: cause,
      age: champion.age,
      kills: champion.kills,
      battles_won: champion.battles_won,
      was_blessed: champion.blessed,
      adjective: champion.blessed ? 'blessed' : 'valiant',
    };

    await generateMyth(state.shardId, faction.id, 'hero_death', eventData, state.tick);

    console.log(`[Champions] ${champion.name} died: ${cause}`);
  } catch (error) {
    console.error('[Champions] Failed to handle death:', error);
  }
}

/**
 * Bless a champion
 */
export async function blessChampion(
  state: GameState,
  faction: Faction,
  championId: string
): Promise<{ success: boolean; error?: string; champion?: Champion }> {
  if (!state.shardId) {
    return { success: false, error: 'No shard ID' };
  }

  // Check divine power
  if (faction.divinePower < CHAMPION_BLESS_COST) {
    return { success: false, error: `Insufficient divine power (need ${CHAMPION_BLESS_COST})` };
  }

  try {
    const champion = await championRepo.getById(championId);
    if (!champion) {
      return { success: false, error: 'Champion not found' };
    }

    if (champion.faction_id !== faction.id) {
      return { success: false, error: 'Champion does not belong to your faction' };
    }

    if (!champion.is_alive) {
      return { success: false, error: 'Champion is not alive' };
    }

    if (champion.blessed) {
      return { success: false, error: 'Champion is already blessed' };
    }

    // Bless the champion
    const blessedChampion = await championRepo.bless(championId, state.tick);

    // Deduct divine power (handled by caller)
    // faction.divinePower -= CHAMPION_BLESS_COST;

    // Create notification
    const notification: DbNotificationInsert = {
      shard_id: state.shardId,
      deity_id: faction.deityId,
      faction_id: faction.id,
      type: 'champion_blessed',
      message: `You have blessed ${champion.name} with divine power!`,
      data: {
        championId: champion.id,
        championName: champion.name,
        newStats: blessedChampion.stats,
        newMaxLifespan: blessedChampion.max_lifespan,
      },
      read: false,
    };
    await notificationRepo.create(notification);

    console.log(`[Champions] ${champion.name} was blessed by ${faction.name}`);

    return { success: true, champion: dbChampionToChampion(blessedChampion) };
  } catch (error) {
    console.error('[Champions] Failed to bless champion:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * Get combat bonus from champion for an army
 */
export function getChampionCombatBonus(champion: Champion): number {
  if (!champion.isAlive) return 0;

  // Base bonus from general type
  let bonus = CHAMPION_GENERAL_COMBAT_BONUS;

  // Additional bonus from stats (normalized combat stat)
  bonus += (champion.stats.combat / 100) * 0.1; // Up to +10% from combat stat

  return bonus;
}

/**
 * Assign champion to army
 */
export async function assignChampionToArmy(
  championId: string,
  armyId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const champion = await championRepo.getById(championId);
    if (!champion) {
      return { success: false, error: 'Champion not found' };
    }

    if (!champion.is_alive) {
      return { success: false, error: 'Champion is not alive' };
    }

    await championRepo.assignToArmy(championId, armyId);
    return { success: true };
  } catch (error) {
    console.error('[Champions] Failed to assign to army:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * Record champion participation in battle
 */
export async function recordChampionBattle(
  championId: string,
  won: boolean,
  kills: number = 0
): Promise<void> {
  try {
    await championRepo.recordBattle(championId, won);
    if (kills > 0) {
      await championRepo.incrementKills(championId, kills);
    }
  } catch (error) {
    console.error('[Champions] Failed to record battle:', error);
  }
}

/**
 * Get champions for a faction
 */
export async function getFactionChampions(factionId: string, aliveOnly = true): Promise<Champion[]> {
  const dbChampions = await championRepo.getByFaction(factionId, aliveOnly);
  return dbChampions.map(dbChampionToChampion);
}

/**
 * Get champions for a shard
 */
export async function getShardChampions(shardId: string, aliveOnly = true): Promise<Champion[]> {
  const dbChampions = await championRepo.getByShard(shardId, aliveOnly);
  return dbChampions.map(dbChampionToChampion);
}

/**
 * Get champion by ID
 */
export async function getChampionById(id: string): Promise<Champion | null> {
  const dbChampion = await championRepo.getById(id);
  return dbChampion ? dbChampionToChampion(dbChampion) : null;
}

/**
 * Convert database champion to API champion
 */
function dbChampionToChampion(dbChampion: {
  id: string;
  shard_id: string;
  faction_id: string;
  territory_id: string | null;
  name: string;
  type: ChampionType;
  age: number;
  max_lifespan: number;
  blessed: boolean;
  blessed_at: number | null;
  stats: ChampionStats;
  assigned_army_id: string | null;
  kills: number;
  battles_won: number;
  battles_fought: number;
  is_alive: boolean;
  death_tick: number | null;
  death_cause: ChampionDeathCause | null;
  created_at: string;
  created_at_tick: number;
}): Champion {
  return {
    id: dbChampion.id,
    shardId: dbChampion.shard_id,
    factionId: dbChampion.faction_id,
    territoryId: dbChampion.territory_id,
    name: dbChampion.name,
    type: dbChampion.type,
    age: dbChampion.age,
    maxLifespan: dbChampion.max_lifespan,
    blessed: dbChampion.blessed,
    blessedAt: dbChampion.blessed_at ?? undefined,
    stats: dbChampion.stats,
    assignedArmyId: dbChampion.assigned_army_id ?? undefined,
    kills: dbChampion.kills,
    battlesWon: dbChampion.battles_won,
    battlesFought: dbChampion.battles_fought,
    isAlive: dbChampion.is_alive,
    deathTick: dbChampion.death_tick ?? undefined,
    deathCause: dbChampion.death_cause ?? undefined,
    createdAt: new Date(dbChampion.created_at).getTime(),
    createdAtTick: dbChampion.created_at_tick,
  };
}
