/**
 * Game state persistence service
 * Handles saving and loading game state to/from Supabase
 */

import { GameState, Territory, Faction, Siege, DiplomaticRelation } from '@pantheon/shared';
import { isSupabaseConfigured } from './supabase.js';
import {
  shardRepo,
  factionRepo,
  territoryRepo,
  siegeRepo,
  relationRepo,
} from './repositories.js';
import {
  DbFaction,
  DbTerritory,
  DbSiege,
  DbFactionUpdate,
  DbTerritoryUpdate,
  DbSiegeUpdate,
} from './types.js';

// Configuration
const SAVE_INTERVAL_TICKS = 10; // Save every 10 ticks

// Track last saved state for diff calculation
let lastSavedState: {
  tick: number;
  territories: Map<string, Territory>;
  factions: Map<string, Faction>;
  sieges: Map<string, Siege>;
} | null = null;

/**
 * Check if we should save state on this tick
 */
export function shouldSaveOnTick(tick: number): boolean {
  return tick > 0 && tick % SAVE_INTERVAL_TICKS === 0;
}

/**
 * Convert in-memory Territory to database format
 */
function territoryToDb(t: Territory, shardId: string): DbTerritoryUpdate {
  return {
    q: t.q,
    r: t.r,
    owner_id: t.owner,
    population: t.population,
    food: t.food,
    production: t.production,
    buildings: t.buildings,
    active_effects: t.activeEffects,
  };
}

/**
 * Convert in-memory Faction to database format
 */
function factionToDb(f: Faction): DbFactionUpdate {
  return {
    name: f.name,
    color: f.color,
    policies: f.policies,
    divine_power: f.divinePower,
    resources: f.resources,
  };
}

/**
 * Convert in-memory Siege to database format
 */
function siegeToDb(s: Siege): DbSiegeUpdate {
  return {
    progress: s.progress,
    attacker_strength: s.attackerStrength,
    defender_strength: s.defenderStrength,
    status: s.status,
  };
}

/**
 * Calculate what changed between two states
 */
function calculateStateDiff(
  prevState: typeof lastSavedState,
  currState: GameState
): {
  changedTerritories: Array<{ id: string; data: DbTerritoryUpdate }>;
  changedFactions: Array<{ id: string; data: DbFactionUpdate }>;
  changedSieges: Array<{ id: string; data: DbSiegeUpdate }>;
  newSieges: Siege[];
  removedSiegeIds: string[];
} {
  const changedTerritories: Array<{ id: string; data: DbTerritoryUpdate }> = [];
  const changedFactions: Array<{ id: string; data: DbFactionUpdate }> = [];
  const changedSieges: Array<{ id: string; data: DbSiegeUpdate }> = [];
  const newSieges: Siege[] = [];
  const removedSiegeIds: string[] = [];

  // Compare territories
  for (const [id, curr] of currState.territories) {
    const prev = prevState?.territories.get(id);
    if (!prev || territoryChanged(prev, curr)) {
      changedTerritories.push({
        id,
        data: territoryToDb(curr, currState.shardId || ''),
      });
    }
  }

  // Compare factions
  for (const [id, curr] of currState.factions) {
    const prev = prevState?.factions.get(id);
    if (!prev || factionChanged(prev, curr)) {
      changedFactions.push({
        id,
        data: factionToDb(curr),
      });
    }
  }

  // Compare sieges
  for (const [id, curr] of currState.sieges) {
    const prev = prevState?.sieges.get(id);
    if (!prev) {
      newSieges.push(curr);
    } else if (siegeChanged(prev, curr)) {
      changedSieges.push({
        id,
        data: siegeToDb(curr),
      });
    }
  }

  // Find removed sieges
  if (prevState) {
    for (const [id] of prevState.sieges) {
      if (!currState.sieges.has(id)) {
        removedSiegeIds.push(id);
      }
    }
  }

  return { changedTerritories, changedFactions, changedSieges, newSieges, removedSiegeIds };
}

function territoryChanged(prev: Territory, curr: Territory): boolean {
  return (
    prev.owner !== curr.owner ||
    prev.population !== curr.population ||
    prev.food !== curr.food ||
    prev.production !== curr.production ||
    prev.activeEffects.length !== curr.activeEffects.length ||
    prev.buildings.length !== curr.buildings.length
  );
}

function factionChanged(prev: Faction, curr: Faction): boolean {
  return (
    prev.territories.length !== curr.territories.length ||
    prev.resources.food !== curr.resources.food ||
    prev.resources.production !== curr.resources.production ||
    prev.resources.gold !== curr.resources.gold ||
    prev.resources.faith !== curr.resources.faith ||
    prev.divinePower !== curr.divinePower ||
    prev.policies.expansion !== curr.policies.expansion ||
    prev.policies.aggression !== curr.policies.aggression
  );
}

function siegeChanged(prev: Siege, curr: Siege): boolean {
  return (
    prev.progress !== curr.progress ||
    prev.attackerStrength !== curr.attackerStrength ||
    prev.defenderStrength !== curr.defenderStrength ||
    prev.status !== curr.status
  );
}

/**
 * Save game state to database (diff-based)
 */
export async function saveGameState(state: GameState): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('[Persistence] Supabase not configured, skipping save');
    return;
  }

  if (!state.shardId) {
    console.warn('[Persistence] No shardId set, cannot save state');
    return;
  }

  try {
    const diff = calculateStateDiff(lastSavedState, state);

    // Update tick on shard
    await shardRepo.updateTick(state.shardId, state.tick);

    // Batch update changed territories
    if (diff.changedTerritories.length > 0) {
      await territoryRepo.batchUpdate(diff.changedTerritories);
      console.log(`[Persistence] Updated ${diff.changedTerritories.length} territories`);
    }

    // Batch update changed factions
    if (diff.changedFactions.length > 0) {
      await factionRepo.batchUpdate(diff.changedFactions);
      console.log(`[Persistence] Updated ${diff.changedFactions.length} factions`);
    }

    // Batch update changed sieges
    if (diff.changedSieges.length > 0) {
      await siegeRepo.batchUpdate(diff.changedSieges);
      console.log(`[Persistence] Updated ${diff.changedSieges.length} sieges`);
    }

    // Create new sieges
    for (const siege of diff.newSieges) {
      await siegeRepo.create({
        shard_id: state.shardId,
        attacker_id: siege.attackerId,
        territory_id: siege.territoryId,
        started_tick: siege.startedAtTick,
        progress: siege.progress,
        required_progress: siege.requiredProgress,
        attacker_strength: siege.attackerStrength,
        defender_strength: siege.defenderStrength,
        status: siege.status,
      });
    }
    if (diff.newSieges.length > 0) {
      console.log(`[Persistence] Created ${diff.newSieges.length} new sieges`);
    }

    // Mark removed sieges as completed/broken (already handled by status change)

    // Update last saved state
    lastSavedState = {
      tick: state.tick,
      territories: new Map(state.territories),
      factions: new Map(state.factions),
      sieges: new Map(state.sieges),
    };

    console.log(`[Persistence] Saved state at tick ${state.tick}`);
  } catch (error) {
    console.error('[Persistence] Failed to save state:', error);
    throw error;
  }
}

/**
 * Load game state from database
 */
export async function loadGameState(shardId: string): Promise<GameState | null> {
  if (!isSupabaseConfigured()) {
    console.log('[Persistence] Supabase not configured, cannot load state');
    return null;
  }

  try {
    // Load shard
    const shard = await shardRepo.getById(shardId);
    if (!shard) {
      console.warn(`[Persistence] Shard ${shardId} not found`);
      return null;
    }

    // Load territories
    const dbTerritories = await territoryRepo.getByShard(shardId);
    const territories = new Map<string, Territory>();
    for (const t of dbTerritories) {
      territories.set(t.id, {
        id: t.id,
        q: t.q,
        r: t.r,
        owner: t.owner_id,
        population: t.population,
        food: t.food,
        production: t.production,
        buildings: t.buildings,
        activeEffects: t.active_effects,
      });
    }

    // Load factions
    const dbFactions = await factionRepo.getByShard(shardId);
    const factions = new Map<string, Faction>();
    for (const f of dbFactions) {
      // Calculate territories list from territories map
      const factionTerritories: string[] = [];
      for (const [tid, t] of territories) {
        if (t.owner === f.id) {
          factionTerritories.push(tid);
        }
      }

      factions.set(f.id, {
        id: f.id,
        name: f.name,
        color: f.color,
        deityId: f.deity_id || '',
        policies: f.policies,
        territories: factionTerritories,
        resources: f.resources,
        divinePower: f.divine_power,
        reputation: f.reputation ?? 50, // Default to 50 if not set
        specialization: f.specialization ?? null,
        createdAtTick: f.created_at_tick ?? 0,
        specializationUnlockAvailable: f.specialization_unlock_available ?? false,
      });
    }

    // Load active sieges
    const dbSieges = await siegeRepo.getActive(shardId);
    const sieges = new Map<string, Siege>();
    for (const s of dbSieges) {
      sieges.set(s.id, {
        id: s.id,
        attackerId: s.attacker_id,
        territoryId: s.territory_id,
        startedAtTick: s.started_tick,
        progress: s.progress,
        requiredProgress: s.required_progress,
        attackerStrength: s.attacker_strength,
        defenderStrength: s.defender_strength,
        status: s.status,
      });
    }

    // Load relations
    const dbRelations = await relationRepo.getByShard(shardId);
    const relations = new Map<string, DiplomaticRelation>();
    for (const r of dbRelations) {
      relations.set(r.id, {
        id: r.id,
        factionA: r.faction_a,
        factionB: r.faction_b,
        status: r.status,
        sinceTick: r.since_tick,
        proposedBy: r.proposed_by || undefined,
        proposalType: r.proposal_type || undefined,
      });
    }

    const gameState: GameState = {
      tick: shard.current_tick,
      shardId: shard.id,
      territories,
      factions,
      pendingBattles: [], // PendingBattles are not persisted (short-lived)
      sieges,
      relations,
    };

    // Update last saved state for diff tracking
    lastSavedState = {
      tick: gameState.tick,
      territories: new Map(territories),
      factions: new Map(factions),
      sieges: new Map(sieges),
    };

    console.log(`[Persistence] Loaded state at tick ${shard.current_tick}`);
    console.log(`[Persistence] ${territories.size} territories, ${factions.size} factions, ${sieges.size} active sieges, ${relations.size} relations`);

    return gameState;
  } catch (error) {
    console.error('[Persistence] Failed to load state:', error);
    throw error;
  }
}

/**
 * Create a new shard with initial game state
 */
export async function createNewShard(
  name: string,
  state: GameState
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    console.log('[Persistence] Supabase not configured, cannot create shard');
    return null;
  }

  try {
    // Create shard
    const shard = await shardRepo.create({
      name,
      current_tick: state.tick,
      status: 'active',
    });

    // Create territories
    const territoryInserts = Array.from(state.territories.values()).map((t) => ({
      shard_id: shard.id,
      q: t.q,
      r: t.r,
      owner_id: t.owner,
      population: t.population,
      food: t.food,
      production: t.production,
      buildings: t.buildings,
      active_effects: t.activeEffects,
    }));

    if (territoryInserts.length > 0) {
      await territoryRepo.batchCreate(territoryInserts);
    }

    // Create factions
    for (const f of state.factions.values()) {
      await factionRepo.create({
        shard_id: shard.id,
        deity_id: f.deityId || null,
        name: f.name,
        color: f.color,
        policies: f.policies,
        divine_power: f.divinePower,
        resources: f.resources,
        is_ai: !f.deityId,
        reputation: f.reputation ?? 50,
        specialization: f.specialization ?? null,
        created_at_tick: f.createdAtTick ?? 0,
        specialization_unlock_available: f.specializationUnlockAvailable ?? false,
      });
    }

    // Update state with shard ID
    state.shardId = shard.id;

    console.log(`[Persistence] Created new shard: ${shard.id} (${name})`);
    return shard.id;
  } catch (error) {
    console.error('[Persistence] Failed to create shard:', error);
    throw error;
  }
}

/**
 * Save full state (non-diff, for graceful shutdown)
 */
export async function saveFullState(state: GameState): Promise<void> {
  if (!isSupabaseConfigured() || !state.shardId) {
    return;
  }

  // Force full update by clearing last saved state
  lastSavedState = null;
  await saveGameState(state);
}
