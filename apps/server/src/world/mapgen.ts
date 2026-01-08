/**
 * Hex map generator for Pantheon
 * Generates a 61-hex map (radius 4) with random starting resources
 */

import { Territory, hexesInRadius, hexId } from '@pantheon/shared';

// Resource generation bounds
const RESOURCE_BOUNDS = {
  food: { min: 10, max: 100 },
  production: { min: 5, max: 50 },
  population: { min: 0, max: 0 }, // Start empty
};

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random starting resources for a territory
 */
function generateResources(): { food: number; production: number; population: number } {
  return {
    food: randomInt(RESOURCE_BOUNDS.food.min, RESOURCE_BOUNDS.food.max),
    production: randomInt(RESOURCE_BOUNDS.production.min, RESOURCE_BOUNDS.production.max),
    population: randomInt(RESOURCE_BOUNDS.population.min, RESOURCE_BOUNDS.population.max),
  };
}

/**
 * Generate a territory at the given hex coordinates
 */
function createTerritory(q: number, r: number): Territory {
  const resources = generateResources();
  return {
    id: hexId({ q, r }),
    q,
    r,
    owner: null,
    population: resources.population,
    food: resources.food,
    production: resources.production,
    buildings: [],
    activeEffects: [],
  };
}

/**
 * Generate a hex map with the specified radius
 * Radius 4 creates a 61-hex map (1 + 6 + 12 + 18 + 24 = 61)
 *
 * @param radius - The radius of the hex map (default: 4)
 * @returns Map of territory ID to Territory
 */
export function generateHexMap(radius: number = 4): Map<string, Territory> {
  const territories = new Map<string, Territory>();

  // Get all hex coordinates within the radius
  const hexCoords = hexesInRadius({ q: 0, r: 0 }, radius);

  // Create a territory for each hex
  for (const coord of hexCoords) {
    const territory = createTerritory(coord.q, coord.r);
    territories.set(territory.id, territory);
  }

  return territories;
}

/**
 * Get the total number of hexes for a given radius
 * Formula: 1 + 3*n*(n+1) where n = radius
 */
export function hexCountForRadius(radius: number): number {
  return 1 + 3 * radius * (radius + 1);
}

/**
 * Convert territories Map to a plain object for JSON serialization
 */
export function serializeTerritories(territories: Map<string, Territory>): Record<string, Territory> {
  const result: Record<string, Territory> = {};
  for (const [id, territory] of territories) {
    result[id] = territory;
  }
  return result;
}

/**
 * Convert territories object back to Map
 */
export function deserializeTerritories(data: Record<string, Territory>): Map<string, Territory> {
  return new Map(Object.entries(data));
}
