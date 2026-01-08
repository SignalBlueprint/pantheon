/**
 * Siege System for Pantheon
 * Handles long-duration territory captures (24-48+ hours)
 */

import {
  GameState,
  Siege,
  Territory,
  Faction,
  SIEGE_MIN_PROGRESS,
  SIEGE_DEFENDED_MULTIPLIER,
  SiegeStatus,
} from '@pantheon/shared';
import { v4 as uuidv4 } from 'uuid';
import { getDefenseMultiplier } from '../systems/specialization.js';

/**
 * Result of a siege operation
 */
export interface SiegeResult {
  success: boolean;
  siege?: Siege;
  error?: string;
}

/**
 * Siege event for notifications
 */
export interface SiegeEvent {
  type: 'started' | 'progress_50' | 'progress_90' | 'completed' | 'broken';
  siege: Siege;
  territoryId: string;
  attackerFactionId: string;
  defenderFactionId: string | null;
}

// Callback for siege events (used for notifications)
export type OnSiegeEvent = (event: SiegeEvent) => void;

/**
 * Calculate required progress for a siege based on defender presence
 */
export function calculateRequiredProgress(defenderStrength: number): number {
  if (defenderStrength > 0) {
    // Defended territory: 48+ hours
    return SIEGE_MIN_PROGRESS * SIEGE_DEFENDED_MULTIPLIER;
  }
  // Undefended territory: 24 hours
  return SIEGE_MIN_PROGRESS;
}

/**
 * Calculate siege progress per tick based on relative strengths
 * Base rate: 1 progress per tick for evenly matched forces
 */
export function calculateProgressPerTick(
  attackerStrength: number,
  defenderStrength: number
): number {
  if (attackerStrength <= 0) return 0;

  // Base progress rate
  let baseProgress = 1;

  if (defenderStrength > 0) {
    // Progress is reduced based on defender strength
    const ratio = attackerStrength / defenderStrength;
    if (ratio < 0.5) {
      // Significantly outmatched - very slow progress
      baseProgress = 0.1;
    } else if (ratio < 1) {
      // Somewhat outmatched - slow progress
      baseProgress = ratio * 0.5;
    } else if (ratio > 2) {
      // Significantly stronger - faster progress
      baseProgress = Math.min(2, ratio * 0.5);
    } else {
      // Roughly matched - normal progress
      baseProgress = ratio * 0.5;
    }
  }

  return baseProgress;
}

/**
 * Start a new siege on a territory
 */
export function startSiege(
  state: GameState,
  attackerId: string,
  territoryId: string,
  attackerStrength: number
): SiegeResult {
  // Validate attacker faction exists
  const attacker = state.factions.get(attackerId);
  if (!attacker) {
    return { success: false, error: 'Attacker faction not found' };
  }

  // Validate territory exists
  const territory = state.territories.get(territoryId);
  if (!territory) {
    return { success: false, error: 'Territory not found' };
  }

  // Can't siege own territory
  if (territory.owner === attackerId) {
    return { success: false, error: 'Cannot siege own territory' };
  }

  // Check if territory is already under siege
  for (const siege of state.sieges.values()) {
    if (siege.territoryId === territoryId && siege.status === 'active') {
      return { success: false, error: 'Territory already under siege' };
    }
  }

  // Check if territory is shielded (Divine Shield miracle)
  const isShielded = territory.activeEffects.some(
    (effect) => effect.modifier.isShielded
  );
  if (isShielded) {
    return { success: false, error: 'Territory is protected by Divine Shield' };
  }

  // Calculate defender strength (based on population and any defending armies)
  const defenderStrength = calculateDefenderStrength(state, territory);
  const requiredProgress = calculateRequiredProgress(defenderStrength);

  // Create the siege
  const siege: Siege = {
    id: uuidv4(),
    attackerId,
    territoryId,
    startedAtTick: state.tick,
    progress: 0,
    requiredProgress,
    attackerStrength,
    defenderStrength,
    status: 'active',
  };

  // Add to state
  state.sieges.set(siege.id, siege);

  console.log(
    `[Siege] Started: ${attacker.name} sieging territory ${territoryId} ` +
    `(${attackerStrength} vs ${defenderStrength}, need ${requiredProgress} progress)`
  );

  return { success: true, siege };
}

/**
 * Calculate defender strength for a territory
 * Includes specialization bonuses (Fortress = 1.5x defense)
 */
function calculateDefenderStrength(
  state: GameState,
  territory: Territory
): number {
  if (!territory.owner) return 0;

  const defender = state.factions.get(territory.owner);

  // Base defense from population
  let strength = Math.floor(territory.population * 0.1);

  // Apply defense multipliers from active effects
  for (const effect of territory.activeEffects) {
    if (effect.modifier.defenseMultiplier) {
      strength = Math.floor(strength * effect.modifier.defenseMultiplier);
    }
  }

  // Add fortress building bonus if present
  if (territory.buildings.includes('fortress')) {
    strength = Math.floor(strength * 1.5);
  }

  // Apply specialization defense multiplier (Fortress specialization = 1.5x)
  if (defender) {
    const specDefenseMultiplier = getDefenseMultiplier(defender);
    strength = Math.floor(strength * specDefenseMultiplier);
  }

  return strength;
}

/**
 * Process all active sieges for one tick
 */
export function processSieges(
  state: GameState,
  onEvent?: OnSiegeEvent
): void {
  const siegesToRemove: string[] = [];
  const progressThresholds = [50, 90]; // Notification thresholds

  for (const siege of state.sieges.values()) {
    if (siege.status !== 'active') continue;

    const territory = state.territories.get(siege.territoryId);
    if (!territory) {
      // Territory no longer exists, abandon siege
      siege.status = 'abandoned';
      siegesToRemove.push(siege.id);
      continue;
    }

    // Update defender strength (may have changed)
    const newDefenderStrength = calculateDefenderStrength(state, territory);
    siege.defenderStrength = newDefenderStrength;

    // Calculate progress this tick
    const progressThisTick = calculateProgressPerTick(
      siege.attackerStrength,
      siege.defenderStrength
    );

    const previousProgress = siege.progress;
    siege.progress += progressThisTick;

    // Check for progress milestone notifications
    for (const threshold of progressThresholds) {
      const thresholdValue = (siege.requiredProgress * threshold) / 100;
      if (previousProgress < thresholdValue && siege.progress >= thresholdValue) {
        onEvent?.({
          type: threshold === 50 ? 'progress_50' : 'progress_90',
          siege,
          territoryId: siege.territoryId,
          attackerFactionId: siege.attackerId,
          defenderFactionId: territory.owner,
        });
      }
    }

    // Check if siege is complete
    if (siege.progress >= siege.requiredProgress) {
      completeSiege(state, siege, territory, onEvent);
      siegesToRemove.push(siege.id);
    }
  }

  // Remove completed/abandoned sieges from active tracking
  // (they remain in DB with their status for history)
}

/**
 * Complete a siege - transfer territory ownership
 */
function completeSiege(
  state: GameState,
  siege: Siege,
  territory: Territory,
  onEvent?: OnSiegeEvent
): void {
  const previousOwner = territory.owner;
  const attacker = state.factions.get(siege.attackerId);

  // Transfer territory ownership
  territory.owner = siege.attackerId;

  // Update faction territory lists
  if (previousOwner) {
    const defender = state.factions.get(previousOwner);
    if (defender) {
      defender.territories = defender.territories.filter(
        (id) => id !== territory.id
      );
    }
  }

  if (attacker) {
    attacker.territories.push(territory.id);
  }

  // Mark siege as completed
  siege.status = 'completed';

  console.log(
    `[Siege] Completed: Territory ${territory.id} captured by ${attacker?.name || siege.attackerId}`
  );

  // Emit completion event
  onEvent?.({
    type: 'completed',
    siege,
    territoryId: siege.territoryId,
    attackerFactionId: siege.attackerId,
    defenderFactionId: previousOwner,
  });
}

/**
 * Break an active siege (defender successfully repels attacker)
 */
export function breakSiege(
  state: GameState,
  siegeId: string,
  onEvent?: OnSiegeEvent
): boolean {
  const siege = state.sieges.get(siegeId);
  if (!siege || siege.status !== 'active') {
    return false;
  }

  const territory = state.territories.get(siege.territoryId);

  siege.status = 'broken';

  console.log(`[Siege] Broken: Siege ${siegeId} on territory ${siege.territoryId}`);

  onEvent?.({
    type: 'broken',
    siege,
    territoryId: siege.territoryId,
    attackerFactionId: siege.attackerId,
    defenderFactionId: territory?.owner || null,
  });

  return true;
}

/**
 * Abandon a siege (attacker withdraws)
 */
export function abandonSiege(
  state: GameState,
  siegeId: string
): boolean {
  const siege = state.sieges.get(siegeId);
  if (!siege || siege.status !== 'active') {
    return false;
  }

  siege.status = 'abandoned';

  console.log(`[Siege] Abandoned: Siege ${siegeId} on territory ${siege.territoryId}`);

  return true;
}

/**
 * Reinforce a siege with additional attacker strength
 */
export function reinforceSiege(
  state: GameState,
  siegeId: string,
  additionalStrength: number
): boolean {
  const siege = state.sieges.get(siegeId);
  if (!siege || siege.status !== 'active') {
    return false;
  }

  siege.attackerStrength += additionalStrength;

  console.log(
    `[Siege] Reinforced: Siege ${siegeId} now has ${siege.attackerStrength} attacker strength`
  );

  return true;
}

/**
 * Get siege status for a territory
 */
export function getTerritorySeige(
  state: GameState,
  territoryId: string
): Siege | null {
  for (const siege of state.sieges.values()) {
    if (siege.territoryId === territoryId && siege.status === 'active') {
      return siege;
    }
  }
  return null;
}

/**
 * Get all active sieges for a faction (as attacker)
 */
export function getFactionSieges(
  state: GameState,
  factionId: string
): Siege[] {
  const sieges: Siege[] = [];
  for (const siege of state.sieges.values()) {
    if (siege.attackerId === factionId && siege.status === 'active') {
      sieges.push(siege);
    }
  }
  return sieges;
}

/**
 * Get all territories under siege (as defender)
 */
export function getTerritoriesUnderSiege(
  state: GameState,
  factionId: string
): Siege[] {
  const sieges: Siege[] = [];
  for (const siege of state.sieges.values()) {
    if (siege.status !== 'active') continue;
    const territory = state.territories.get(siege.territoryId);
    if (territory?.owner === factionId) {
      sieges.push(siege);
    }
  }
  return sieges;
}
