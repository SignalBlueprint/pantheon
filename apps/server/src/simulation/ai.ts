/**
 * Faction AI decision maker for Pantheon
 * Runs once per faction per tick, making decisions based on policies
 */

import {
  GameState,
  Faction,
  Territory,
  PendingBattle,
  hexNeighbors,
  hexId,
  parseHexId,
} from '@pantheon/shared';

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
 */
function getAdjacentTerritories(
  state: GameState,
  faction: Faction
): { unclaimed: Territory[]; enemy: Territory[] } {
  const unclaimed: Territory[] = [];
  const enemy: Territory[] = [];
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
        enemy.push(neighborTerritory);
      }
    }
  }

  return { unclaimed, enemy };
}

/**
 * Process AI decisions for a single faction
 */
export function processAIDecision(state: GameState, faction: Faction): void {
  const { policies, resources } = faction;
  const { unclaimed, enemy } = getAdjacentTerritories(state, faction);

  // Expansion logic - if expansion > 50 and adjacent unclaimed territory exists
  if (addRandomness(policies.expansion) > 50 && unclaimed.length > 0) {
    processExpansion(state, faction, unclaimed);
  }

  // Aggression logic - if aggression > 50 and adjacent enemy territory
  if (addRandomness(policies.aggression) > 50 && enemy.length > 0) {
    processAggression(state, faction, enemy);
  }

  // Defense logic - if own territory under threat
  processDefense(state, faction);
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
 * Process aggression - queue attack on enemy territory
 */
function processAggression(
  state: GameState,
  faction: Faction,
  enemy: Territory[]
): void {
  if (faction.resources.production < ATTACK_COST) return;

  // Check if we already have a pending battle with this target
  const pendingTargets = new Set(
    state.pendingBattles
      .filter((b) => b.attackerId === faction.id)
      .map((b) => b.territoryId)
  );

  // Find a target we're not already attacking
  const validTargets = enemy.filter((t) => !pendingTargets.has(t.id));
  if (validTargets.length === 0) return;

  // Pick random target
  const target = validTargets[Math.floor(Math.random() * validTargets.length)];
  const defender = state.factions.get(target.owner!);
  if (!defender) return;

  // Calculate strength based on population
  const attackerStrength = calculateFactionStrength(state, faction);
  const defenderStrength = target.population * 10;

  // Only attack if we have reasonable chance
  if (attackerStrength < defenderStrength * 0.5) return;

  // Queue the attack
  faction.resources.production -= ATTACK_COST;

  const battle: PendingBattle = {
    id: `battle_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    attackerId: faction.id,
    defenderId: target.owner!,
    territoryId: target.id,
    attackerStrength,
    defenderStrength,
    startedAtTick: state.tick,
  };

  state.pendingBattles.push(battle);
  console.log(`[AI] ${faction.name} attacks ${defender.name}'s territory ${target.id}`);
}

/**
 * Process defense - if own territory under threat, bolster defense
 */
function processDefense(state: GameState, faction: Faction): void {
  // Check for incoming attacks
  const incomingAttacks = state.pendingBattles.filter(
    (b) => b.defenderId === faction.id
  );

  if (incomingAttacks.length === 0) return;

  // For now, just increase defender strength if we have resources
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
export function processAllAI(state: GameState): void {
  for (const faction of state.factions.values()) {
    // Skip player-controlled factions (deityId not 'ai')
    if (faction.deityId !== 'ai') continue;
    processAIDecision(state, faction);
  }
}

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
