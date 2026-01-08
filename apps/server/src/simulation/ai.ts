/**
 * Faction AI decision maker for Pantheon
 * Runs once per faction per tick, making decisions based on policies
 */

import {
  GameState,
  Faction,
  Territory,
  PendingBattle,
  Siege,
  hexNeighbors,
  hexId,
  parseHexId,
  DIPLOMACY_WAR_COST,
} from '@pantheon/shared';
import {
  startSiege,
  getTerritorySeige,
  getFactionSieges,
  getTerritoriesUnderSiege,
  reinforceSiege,
  breakSiege,
  SiegeEvent,
  OnSiegeEvent,
} from './siege.js';
import {
  canAttack,
  areAllied,
  getAllies,
  getEnemies,
  getRelationStatus,
  declareWar,
} from '../systems/diplomacy.js';

// AI decision costs
const EXPANSION_COST = 20; // Production cost to claim a territory
const ATTACK_COST = 30; // Production cost to initiate an attack

// Randomness range (±20%)
const RANDOMNESS_FACTOR = 0.2;

/**
 * Add randomness to a value (±20%)
 */
function addRandomness(value: number): number {
  const variance = value * RANDOMNESS_FACTOR;
  return value + (Math.random() * 2 - 1) * variance;
}

/**
 * Get adjacent territories to a faction's controlled territories
 * Filters based on diplomatic relations
 */
function getAdjacentTerritories(
  state: GameState,
  faction: Faction
): { unclaimed: Territory[]; enemy: Territory[]; potentialTargets: Territory[] } {
  const unclaimed: Territory[] = [];
  const enemy: Territory[] = []; // Only factions we're at war with
  const potentialTargets: Territory[] = []; // Factions we're neutral with
  const seen = new Set<string>();

  for (const territoryId of faction.territories) {
    const territory = state.territories.get(territoryId);
    if (!territory) continue;

    const neighbors = hexNeighbors({ q: territory.q, r: territory.r });
    for (const neighbor of neighbors) {
      const neighborId = hexId(neighbor);
      if (seen.has(neighborId)) continue;
      seen.add(neighborId);

      const neighborTerritory = state.territories.get(neighborId);
      if (!neighborTerritory) continue;
      if (neighborTerritory.owner === faction.id) continue;

      if (neighborTerritory.owner === null) {
        unclaimed.push(neighborTerritory);
      } else {
        // Check diplomatic relations
        const ownerId = neighborTerritory.owner;
        if (areAllied(state, faction.id, ownerId)) {
          // Allied territory - skip
          continue;
        } else if (canAttack(state, faction.id, ownerId)) {
          // At war - valid target
          enemy.push(neighborTerritory);
        } else {
          // Neutral - potential target (need to declare war first)
          potentialTargets.push(neighborTerritory);
        }
      }
    }
  }

  return { unclaimed, enemy, potentialTargets };
}

/**
 * Process AI decisions for a single faction
 */
export function processAIDecision(
  state: GameState,
  faction: Faction,
  onSiegeEvent?: OnSiegeEvent
): void {
  const { policies, resources } = faction;
  const { unclaimed, enemy, potentialTargets } = getAdjacentTerritories(state, faction);

  // Defense logic first - if own territory under threat
  processDefense(state, faction, onSiegeEvent);

  // Expansion logic - if expansion > 50 and adjacent unclaimed territory exists
  if (addRandomness(policies.expansion) > 50 && unclaimed.length > 0) {
    processExpansion(state, faction, unclaimed);
  }

  // Aggression logic - if aggression > 50 and adjacent enemy territory
  if (addRandomness(policies.aggression) > 50) {
    if (enemy.length > 0) {
      // We have enemies at war - attack them
      processAggression(state, faction, enemy, onSiegeEvent);
    } else if (potentialTargets.length > 0 && faction.divinePower >= DIPLOMACY_WAR_COST) {
      // No current enemies but high aggression - consider declaring war
      processDiplomacy(state, faction, potentialTargets);
    }
  }
}

/**
 * Process AI diplomacy - declare war when aggressive and profitable
 */
function processDiplomacy(
  state: GameState,
  faction: Faction,
  potentialTargets: Territory[]
): void {
  // Pick a weaker target to declare war on
  const targetFactions = new Map<string, number>();

  for (const territory of potentialTargets) {
    if (!territory.owner) continue;
    targetFactions.set(
      territory.owner,
      (targetFactions.get(territory.owner) || 0) + 1
    );
  }

  // Find the faction with the most adjacent territories that is weaker than us
  const ourStrength = calculateFactionStrength(state, faction);
  let bestTarget: string | null = null;
  let bestScore = 0;

  for (const [factionId, adjacentCount] of targetFactions) {
    const targetFaction = state.factions.get(factionId);
    if (!targetFaction) continue;

    const theirStrength = calculateFactionStrength(state, targetFaction);

    // Only target weaker factions (at least 30% weaker)
    if (theirStrength < ourStrength * 0.7) {
      // Score based on adjacency and weakness
      const score = adjacentCount * (1 - theirStrength / ourStrength);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = factionId;
      }
    }
  }

  if (bestTarget) {
    const target = state.factions.get(bestTarget);
    const result = declareWar(state, faction.id, bestTarget);
    if (result.success) {
      console.log(`[AI Diplomacy] ${faction.name} declared war on ${target?.name}`);
    }
  }
}

/**
 * Process expansion - claim unclaimed adjacent territory
 */
function processExpansion(
  state: GameState,
  faction: Faction,
  unclaimed: Territory[]
): void {
  if (faction.resources.production < EXPANSION_COST) return;

  // Pick random unclaimed territory
  const target = unclaimed[Math.floor(Math.random() * unclaimed.length)];

  // Claim it
  faction.resources.production -= EXPANSION_COST;
  target.owner = faction.id;
  faction.territories.push(target.id);
  target.population = 50; // Initial settlers

  console.log(`[AI] ${faction.name} expanded to territory ${target.id}`);
}

/**
 * Process aggression - start siege on enemy territory
 */
function processAggression(
  state: GameState,
  faction: Faction,
  enemy: Territory[],
  onSiegeEvent?: OnSiegeEvent
): void {
  if (faction.resources.production < ATTACK_COST) return;

  // Get existing sieges we're conducting
  const existingSieges = getFactionSieges(state, faction.id);
  const siegeTargets = new Set(existingSieges.map((s) => s.territoryId));

  // Find a target we're not already sieging
  const validTargets = enemy.filter((t) => !siegeTargets.has(t.id));
  if (validTargets.length === 0) {
    // Maybe reinforce existing siege instead
    if (existingSieges.length > 0 && faction.resources.production >= 20) {
      const siegeToReinforce = existingSieges[Math.floor(Math.random() * existingSieges.length)];
      faction.resources.production -= 20;
      reinforceSiege(state, siegeToReinforce.id, 50);
      console.log(`[AI] ${faction.name} reinforces siege on territory ${siegeToReinforce.territoryId}`);
    }
    return;
  }

  // Pick random target
  const target = validTargets[Math.floor(Math.random() * validTargets.length)];
  const defender = state.factions.get(target.owner!);
  if (!defender) return;

  // Calculate strength based on population
  const attackerStrength = Math.floor(calculateFactionStrength(state, faction) * 0.3); // Commit 30% of forces
  const defenderStrength = target.population * 10;

  // Only attack if we have reasonable chance
  if (attackerStrength < defenderStrength * 0.3) return;

  // Start the siege
  faction.resources.production -= ATTACK_COST;

  const result = startSiege(state, faction.id, target.id, attackerStrength);

  if (result.success && result.siege) {
    console.log(`[AI] ${faction.name} starts siege on ${defender.name}'s territory ${target.id}`);
    onSiegeEvent?.({
      type: 'started',
      siege: result.siege,
      territoryId: target.id,
      attackerFactionId: faction.id,
      defenderFactionId: target.owner,
    });
  }
}

/**
 * Process defense - if own territory under siege, try to break it
 */
function processDefense(
  state: GameState,
  faction: Faction,
  onSiegeEvent?: OnSiegeEvent
): void {
  // Get territories under siege
  const siegesAgainstUs = getTerritoriesUnderSiege(state, faction.id);

  if (siegesAgainstUs.length === 0) return;

  for (const siege of siegesAgainstUs) {
    const territory = state.territories.get(siege.territoryId);
    if (!territory) continue;

    // Calculate our defensive strength
    const defenseStrength = calculateFactionStrength(state, faction) * 0.5;

    // AI retreat logic: if siege is at 90%+ progress and we're significantly outmatched
    if (siege.progress >= siege.requiredProgress * 0.9) {
      if (defenseStrength < siege.attackerStrength * 0.3) {
        // Territory is lost, don't waste resources
        console.log(`[AI] ${faction.name} abandons defense of territory ${siege.territoryId} (hopeless)`);
        continue;
      }
    }

    // Try to break the siege if we have enough resources and strength
    if (faction.resources.production >= 30 && defenseStrength > siege.attackerStrength * 0.8) {
      faction.resources.production -= 30;

      // Attempt to break siege - success based on strength ratio
      const successChance = defenseStrength / (siege.attackerStrength + defenseStrength);
      if (Math.random() < successChance) {
        breakSiege(state, siege.id, onSiegeEvent);
        console.log(`[AI] ${faction.name} broke the siege on territory ${siege.territoryId}!`);
      } else {
        // Failed to break siege, but reduced attacker strength
        siege.attackerStrength = Math.floor(siege.attackerStrength * 0.8);
        console.log(`[AI] ${faction.name} failed to break siege but weakened attackers`);
      }
    }
  }

  // Legacy support for pending battles (will be phased out)
  const incomingAttacks = state.pendingBattles.filter(
    (b) => b.defenderId === faction.id
  );

  for (const battle of incomingAttacks) {
    if (faction.resources.production >= 10) {
      faction.resources.production -= 10;
      battle.defenderStrength += 50;
      console.log(`[AI] ${faction.name} reinforces defense of territory ${battle.territoryId}`);
    }
  }
}

/**
 * Calculate total faction strength based on controlled territories
 */
function calculateFactionStrength(state: GameState, faction: Faction): number {
  let strength = 0;
  for (const territoryId of faction.territories) {
    const territory = state.territories.get(territoryId);
    if (territory) {
      strength += territory.population * 10;
    }
  }
  return strength;
}

/**
 * Process all AI factions
 */
export function processAllAI(state: GameState, onSiegeEvent?: OnSiegeEvent): void {
  for (const faction of state.factions.values()) {
    // Skip player-controlled factions (deityId not 'ai')
    if (faction.deityId !== 'ai') continue;
    processAIDecision(state, faction, onSiegeEvent);
  }
}

// Re-export siege event type for use in other modules
export type { OnSiegeEvent };

/**
 * Resolve pending battles
 */
export function resolveBattles(state: GameState): void {
  const completedBattles: string[] = [];

  for (const battle of state.pendingBattles) {
    // Battles resolve after 5 ticks (simplified siege)
    if (state.tick - battle.startedAtTick < 5) continue;

    const attacker = state.factions.get(battle.attackerId);
    const defender = state.factions.get(battle.defenderId);
    const territory = state.territories.get(battle.territoryId);

    if (!attacker || !defender || !territory) {
      completedBattles.push(battle.id);
      continue;
    }

    // Simple combat resolution
    const attackerRoll = battle.attackerStrength * (0.8 + Math.random() * 0.4);
    const defenderRoll = battle.defenderStrength * (0.8 + Math.random() * 0.4);

    if (attackerRoll > defenderRoll) {
      // Attacker wins - capture territory
      const defenderIndex = defender.territories.indexOf(territory.id);
      if (defenderIndex !== -1) {
        defender.territories.splice(defenderIndex, 1);
      }
      territory.owner = attacker.id;
      attacker.territories.push(territory.id);
      territory.population = Math.floor(territory.population * 0.5); // Population loss

      console.log(`[Battle] ${attacker.name} captured territory ${territory.id} from ${defender.name}`);
    } else {
      // Defender wins - attack repelled
      console.log(`[Battle] ${defender.name} repelled ${attacker.name}'s attack on territory ${territory.id}`);
    }

    completedBattles.push(battle.id);
  }

  // Remove completed battles
  state.pendingBattles = state.pendingBattles.filter(
    (b) => !completedBattles.includes(b.id)
  );
}
