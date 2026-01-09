/**
 * Specialization System for Pantheon
 * Handles faction specialization unlocks, selection, and ability application
 */

import {
  GameState,
  Faction,
  SpecializationType,
  Specialization,
  SPECIALIZATIONS,
  SPECIALIZATION_UNLOCK_TICKS,
  SPECIALIZATION_UNLOCK_TERRITORIES,
  canUnlockSpecialization,
} from '@pantheon/shared';

/**
 * Check if a faction can unlock specialization and update their status
 */
export function checkSpecializationUnlock(state: GameState, faction: Faction): boolean {
  // Already has specialization or already notified
  if (faction.specialization !== null || faction.specializationUnlockAvailable) {
    return false;
  }

  const eligible = canUnlockSpecialization(
    faction.createdAtTick,
    state.tick,
    faction.territories.length
  );

  if (eligible) {
    faction.specializationUnlockAvailable = true;
    console.log(`[Specialization] ${faction.name} can now choose a specialization!`);
    return true;
  }

  return false;
}

/**
 * Choose a specialization for a faction
 */
export interface ChooseSpecializationResult {
  success: boolean;
  error?: string;
  specialization?: Specialization;
}

export function chooseSpecialization(
  faction: Faction,
  specializationType: Exclude<SpecializationType, null>
): ChooseSpecializationResult {
  // Validate faction is eligible
  if (!faction.specializationUnlockAvailable) {
    return {
      success: false,
      error: 'Faction has not unlocked specialization yet',
    };
  }

  // Can't change once chosen
  if (faction.specialization !== null) {
    return {
      success: false,
      error: 'Faction already has a specialization',
    };
  }

  // Validate specialization type
  const specialization = SPECIALIZATIONS[specializationType];
  if (!specialization) {
    return {
      success: false,
      error: 'Invalid specialization type',
    };
  }

  // Apply the specialization
  faction.specialization = specializationType;
  faction.specializationUnlockAvailable = false; // No longer pending

  console.log(`[Specialization] ${faction.name} chose ${specialization.name}!`);

  return {
    success: true,
    specialization,
  };
}

/**
 * Get the specialization data for a faction
 */
export function getFactionSpecialization(faction: Faction): Specialization | null {
  if (!faction.specialization) {
    return null;
  }
  return SPECIALIZATIONS[faction.specialization];
}

/**
 * Apply specialization bonuses to calculations
 */
export function getDefenseMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.defenseMultiplier ?? 1.0;
}

export function getPopulationCapMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.populationCapMultiplier ?? 1.0;
}

export function getMovementSpeedMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.movementSpeedMultiplier ?? 1.0;
}

export function getFoodProductionMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.foodProductionMultiplier ?? 1.0;
}

export function getProductionMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.productionMultiplier ?? 1.0;
}

export function getTradeBonus(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.tradeBonus ?? 0;
}

export function canBuildShips(faction: Faction): boolean {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.canBuildShips ?? false;
}

export function canSettleIslands(faction: Faction): boolean {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.canSettleIslands ?? false;
}

export function canRaidWithoutSiege(faction: Faction): boolean {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.canRaidWithoutSiege ?? false;
}

export function getRaidDamageMultiplier(faction: Faction): number {
  const spec = getFactionSpecialization(faction);
  return spec?.bonuses.raidDamageMultiplier ?? 1.0;
}

/**
 * AI chooses specialization based on faction's playstyle
 */
export function aiChooseSpecialization(faction: Faction): Exclude<SpecializationType, null> {
  const { policies } = faction;

  // High aggression prefers Nomadic for raids
  if (policies.aggression > 70) {
    return 'nomadic';
  }

  // High expansion prefers Plains for population
  if (policies.expansion > 70) {
    return 'plains';
  }

  // Low aggression prefers Fortress for defense
  if (policies.aggression < 30) {
    return 'fortress';
  }

  // Balanced or food-focused prefers Plains
  if (policies.resourceFocus === 'food') {
    return 'plains';
  }

  // Production-focused prefers Fortress
  if (policies.resourceFocus === 'production') {
    return 'fortress';
  }

  // Default: random choice weighted by policy
  const choices: Exclude<SpecializationType, null>[] = ['maritime', 'fortress', 'plains', 'nomadic'];
  const randomIndex = Math.floor(Math.random() * choices.length);
  return choices[randomIndex];
}

/**
 * Process specialization checks for all factions
 * Called each tick to check for unlocks
 */
export function processSpecializationTick(state: GameState): void {
  for (const faction of state.factions.values()) {
    // Check for unlock eligibility
    const unlocked = checkSpecializationUnlock(state, faction);

    // If AI faction just unlocked, auto-choose
    if (unlocked && faction.deityId === 'ai') {
      const choice = aiChooseSpecialization(faction);
      chooseSpecialization(faction, choice);
    }
  }
}

/**
 * Get available specializations for display
 */
export function getAvailableSpecializations(): Specialization[] {
  return Object.values(SPECIALIZATIONS);
}
