/**
 * Miracle execution system for Pantheon
 * Validates and applies miracle effects
 */

import {
  GameState,
  Territory,
  Faction,
  ActiveEffect,
  getMiracle,
  canAffordMiracle,
  Miracle,
} from '@pantheon/shared';

export interface MiracleCastResult {
  success: boolean;
  error?: string;
  effectId?: string;
}

/**
 * Validate if a miracle can be cast
 */
export function validateMiracleCast(
  state: GameState,
  factionId: string,
  miracleId: string,
  targetId: string
): { valid: boolean; error?: string; miracle?: Miracle; faction?: Faction; target?: Territory } {
  const miracle = getMiracle(miracleId);
  if (!miracle) {
    return { valid: false, error: `Unknown miracle: ${miracleId}` };
  }

  const faction = state.factions.get(factionId);
  if (!faction) {
    return { valid: false, error: `Unknown faction: ${factionId}` };
  }

  // Check divine power
  if (!canAffordMiracle(faction.divinePower, miracleId)) {
    return { valid: false, error: `Insufficient divine power (need ${miracle.cost}, have ${faction.divinePower})` };
  }

  // Validate target based on miracle type
  if (miracle.targetType === 'territory') {
    const target = state.territories.get(targetId);
    if (!target) {
      return { valid: false, error: `Unknown territory: ${targetId}` };
    }

    // For shield/buff miracles, must be own territory
    if (miracle.effect.isShielded || miracle.effect.foodMultiplier || miracle.effect.productionMultiplier) {
      if (target.owner !== factionId) {
        return { valid: false, error: 'Can only target own territories for buff miracles' };
      }
    }

    return { valid: true, miracle, faction, target };
  }

  // For army/faction targets, handle differently
  // For now, return valid for other target types
  return { valid: true, miracle, faction };
}

/**
 * Cast a miracle on a target
 */
export function castMiracle(
  state: GameState,
  factionId: string,
  miracleId: string,
  targetId: string
): MiracleCastResult {
  const validation = validateMiracleCast(state, factionId, miracleId, targetId);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { miracle, faction, target } = validation;
  if (!miracle || !faction) {
    return { success: false, error: 'Validation failed' };
  }

  // Deduct divine power
  faction.divinePower -= miracle.cost;

  // Generate effect ID
  const effectId = `effect_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Apply effect based on miracle type
  if (miracle.targetType === 'territory' && target) {
    return applyTerritoryEffect(state, target, miracle, effectId);
  }

  if (miracle.targetType === 'army') {
    return applyArmyEffect(state, targetId, miracle, effectId);
  }

  if (miracle.targetType === 'faction') {
    return applyFactionEffect(state, targetId, miracle, effectId);
  }

  return { success: false, error: 'Unknown miracle target type' };
}

/**
 * Apply a miracle effect to a territory
 */
function applyTerritoryEffect(
  state: GameState,
  territory: Territory,
  miracle: Miracle,
  effectId: string
): MiracleCastResult {
  // Handle instant effects (like smite, if targeting territory)
  if (miracle.duration === 0) {
    // Instant effects don't create persistent effects
    console.log(`[Miracle] ${miracle.name} cast on territory ${territory.id} (instant)`);
    return { success: true, effectId };
  }

  // Create active effect
  const effect: ActiveEffect = {
    id: effectId,
    miracleId: miracle.id,
    expiresTick: state.tick + miracle.duration,
    modifier: {
      foodMultiplier: miracle.effect.foodMultiplier,
      productionMultiplier: miracle.effect.productionMultiplier,
      defenseMultiplier: miracle.effect.defenseMultiplier,
      isShielded: miracle.effect.isShielded,
    },
  };

  territory.activeEffects.push(effect);

  console.log(`[Miracle] ${miracle.name} cast on territory ${territory.id}, expires tick ${effect.expiresTick}`);

  return { success: true, effectId };
}

/**
 * Apply a miracle effect to an army (placeholder)
 */
function applyArmyEffect(
  state: GameState,
  armyId: string,
  miracle: Miracle,
  effectId: string
): MiracleCastResult {
  // Handle instant damage (Smite)
  if (miracle.effect.instantDamagePercent) {
    // Find the pending battle with this army and apply damage
    // For now, apply to territory population
    const territory = state.territories.get(armyId);
    if (territory && territory.owner) {
      const damage = Math.floor(territory.population * (miracle.effect.instantDamagePercent / 100));
      territory.population = Math.max(0, territory.population - damage);
      console.log(`[Miracle] ${miracle.name} dealt ${damage} damage to ${armyId}`);
    }
    return { success: true, effectId };
  }

  // Combat buffs would be applied to pending battles
  console.log(`[Miracle] ${miracle.name} cast on army ${armyId}`);
  return { success: true, effectId };
}

/**
 * Apply a miracle effect to a faction (placeholder)
 */
function applyFactionEffect(
  state: GameState,
  factionId: string,
  miracle: Miracle,
  effectId: string
): MiracleCastResult {
  console.log(`[Miracle] ${miracle.name} cast on faction ${factionId}`);
  return { success: true, effectId };
}

/**
 * Check if a territory is shielded (has Divine Shield effect)
 */
export function isTerritoryShielded(territory: Territory): boolean {
  return territory.activeEffects.some((effect) => effect.modifier.isShielded === true);
}
