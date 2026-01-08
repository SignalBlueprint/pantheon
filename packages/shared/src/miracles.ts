/**
 * Miracle types and catalog for Pantheon
 */

// Target types for miracles
export type MiracleTargetType = 'territory' | 'army' | 'faction';

// Miracle definition
export interface Miracle {
  id: string;
  name: string;
  description: string;
  cost: number;
  targetType: MiracleTargetType;
  duration: number; // in ticks, 0 = instant
  cooldown: number; // ticks before can be cast again
  effect: {
    foodMultiplier?: number;
    productionMultiplier?: number;
    defenseMultiplier?: number;
    combatStrengthMultiplier?: number;
    isShielded?: boolean;
    instantDamagePercent?: number;
  };
}

// Miracle catalog
export const MIRACLES: Record<string, Miracle> = {
  bountiful_harvest: {
    id: 'bountiful_harvest',
    name: 'Bountiful Harvest',
    description: '+50% food production for 10 ticks',
    cost: 30,
    targetType: 'territory',
    duration: 10,
    cooldown: 20,
    effect: {
      foodMultiplier: 1.5,
    },
  },

  blessing_of_valor: {
    id: 'blessing_of_valor',
    name: 'Blessing of Valor',
    description: '+30% combat strength for next battle',
    cost: 40,
    targetType: 'army',
    duration: 1, // Lasts until next battle
    cooldown: 15,
    effect: {
      combatStrengthMultiplier: 1.3,
    },
  },

  divine_shield: {
    id: 'divine_shield',
    name: 'Divine Shield',
    description: 'Territory immune to capture for 20 ticks',
    cost: 50,
    targetType: 'territory',
    duration: 20,
    cooldown: 50,
    effect: {
      isShielded: true,
    },
  },

  smite: {
    id: 'smite',
    name: 'Smite',
    description: 'Deal 25% casualties to enemy army instantly',
    cost: 60,
    targetType: 'army',
    duration: 0, // Instant
    cooldown: 30,
    effect: {
      instantDamagePercent: 25,
    },
  },

  inspire: {
    id: 'inspire',
    name: 'Inspire',
    description: '+100% production for 5 ticks',
    cost: 35,
    targetType: 'territory',
    duration: 5,
    cooldown: 15,
    effect: {
      productionMultiplier: 2.0,
    },
  },
};

// Get all miracles as an array
export const MIRACLE_LIST = Object.values(MIRACLES);

// Get a miracle by ID
export function getMiracle(id: string): Miracle | undefined {
  return MIRACLES[id];
}

// Check if a faction can afford a miracle
export function canAffordMiracle(divinePower: number, miracleId: string): boolean {
  const miracle = getMiracle(miracleId);
  if (!miracle) return false;
  return divinePower >= miracle.cost;
}
