/**
 * Faction factory and management for Pantheon
 */

import { Faction, Policy, Territory, hexDistance, HexCoord, DIVINE_POWER_START } from '@pantheon/shared';

// Default policies for new factions
const DEFAULT_POLICY: Policy = {
  expansion: 50,
  aggression: 50,
  resourceFocus: 'balanced',
};

// Starting resources for new factions
const STARTING_RESOURCES = {
  food: 100,
  production: 50,
  gold: 0,
  faith: 0,
};

let factionIdCounter = 0;

/**
 * Generate a unique faction ID
 */
function generateFactionId(): string {
  return `faction${++factionIdCounter}`;
}

/**
 * Create a new faction
 *
 * @param name - Faction display name
 * @param color - Hex color for map display
 * @param startingTerritory - The territory where this faction starts
 * @param deityId - ID of the controlling deity (player or AI)
 * @returns New Faction object
 */
export function createFaction(
  name: string,
  color: string,
  startingTerritory: Territory,
  deityId: string = 'ai'
): Faction {
  const faction: Faction = {
    id: generateFactionId(),
    name,
    color,
    deityId,
    policies: { ...DEFAULT_POLICY },
    territories: [startingTerritory.id],
    resources: { ...STARTING_RESOURCES },
    divinePower: DIVINE_POWER_START,
    reputation: 50, // Start with neutral reputation
  };

  return faction;
}

/**
 * Find starting positions that maximize distance between factions
 *
 * @param territories - All available territories
 * @param count - Number of starting positions needed
 * @returns Array of territory IDs for starting positions
 */
export function selectStartingPositions(
  territories: Map<string, Territory>,
  count: number
): string[] {
  if (territories.size < count) {
    throw new Error(`Not enough territories (${territories.size}) for ${count} factions`);
  }

  const territoryList = Array.from(territories.values());

  // For 2 factions, find the pair with maximum distance
  if (count === 2) {
    let maxDistance = 0;
    let bestPair: [string, string] = [territoryList[0].id, territoryList[1].id];

    for (let i = 0; i < territoryList.length; i++) {
      for (let j = i + 1; j < territoryList.length; j++) {
        const a = territoryList[i];
        const b = territoryList[j];
        const dist = hexDistance({ q: a.q, r: a.r }, { q: b.q, r: b.r });
        if (dist > maxDistance) {
          maxDistance = dist;
          bestPair = [a.id, b.id];
        }
      }
    }

    return bestPair;
  }

  // For more factions, use greedy algorithm
  const selected: string[] = [];
  const selectedCoords: HexCoord[] = [];

  // Start with territory furthest from center (0, 0)
  let maxDistFromCenter = 0;
  let furthestTerritory = territoryList[0];

  for (const t of territoryList) {
    const dist = hexDistance({ q: t.q, r: t.r }, { q: 0, r: 0 });
    if (dist > maxDistFromCenter) {
      maxDistFromCenter = dist;
      furthestTerritory = t;
    }
  }

  selected.push(furthestTerritory.id);
  selectedCoords.push({ q: furthestTerritory.q, r: furthestTerritory.r });

  // Greedily add territories that maximize minimum distance to all selected
  while (selected.length < count) {
    let bestTerritory = territoryList[0];
    let bestMinDist = -1;

    for (const t of territoryList) {
      if (selected.includes(t.id)) continue;

      // Calculate minimum distance to any selected territory
      let minDist = Infinity;
      for (const coord of selectedCoords) {
        const dist = hexDistance({ q: t.q, r: t.r }, coord);
        minDist = Math.min(minDist, dist);
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestTerritory = t;
      }
    }

    selected.push(bestTerritory.id);
    selectedCoords.push({ q: bestTerritory.q, r: bestTerritory.r });
  }

  return selected;
}

/**
 * Assign a territory to a faction
 */
export function assignTerritory(
  faction: Faction,
  territory: Territory
): void {
  if (!faction.territories.includes(territory.id)) {
    faction.territories.push(territory.id);
  }
  territory.owner = faction.id;
}

/**
 * Remove a territory from a faction
 */
export function removeTerritory(
  faction: Faction,
  territory: Territory
): void {
  const index = faction.territories.indexOf(territory.id);
  if (index !== -1) {
    faction.territories.splice(index, 1);
  }
  if (territory.owner === faction.id) {
    territory.owner = null;
  }
}

/**
 * Reset faction ID counter (useful for testing)
 */
export function resetFactionIdCounter(): void {
  factionIdCounter = 0;
}
