/**
 * Game loop / ticker system for Pantheon
 * Manages the world tick cycle and dispatches to subsystems
 */

import { GameState, Territory, Faction, TICK_RATE_MS, DIVINE_POWER_MAX, DIVINE_POWER_REGEN_PER_TEMPLE } from '@pantheon/shared';

// Tick phase callbacks
export type TickPhase = (state: GameState) => void;

export interface TickerConfig {
  tickRate?: number;
  onResourceProduction?: TickPhase;
  onPopulationGrowth?: TickPhase;
  onAIDecisions?: TickPhase;
  onCombatResolution?: TickPhase;
  onSiegeProgress?: TickPhase;
  onPersistence?: TickPhase;
  onBroadcastState?: TickPhase;
}

/**
 * Game ticker - manages the main game loop
 */
export class Ticker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: GameState;
  private config: TickerConfig;
  private running: boolean = false;

  constructor(initialState: GameState, config: TickerConfig = {}) {
    this.state = initialState;
    this.config = {
      tickRate: TICK_RATE_MS,
      ...config,
    };
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.tickRate);

    console.log(`Ticker started at ${this.config.tickRate}ms interval`);
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.running || !this.intervalId) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.running = false;

    console.log('Ticker stopped');
  }

  /**
   * Execute one tick of the game loop
   * Phases: 1) Divine power regen, 2) Effect expiration, 3) Resource production,
   *         4) Population growth, 5) AI decisions, 6) Combat resolution,
   *         7) Siege progress, 8) Persistence, 9) Broadcast state
   */
  tick(): void {
    this.state.tick++;

    // Phase 1: Divine power regeneration
    this.processDivinePowerRegen();

    // Phase 2: Effect expiration
    this.processEffectExpiration();

    // Phase 3: Resource production
    this.config.onResourceProduction?.(this.state);
    this.processResourceProduction();

    // Phase 4: Population growth
    this.config.onPopulationGrowth?.(this.state);
    this.processPopulationGrowth();

    // Phase 5: AI decisions
    this.config.onAIDecisions?.(this.state);

    // Phase 6: Combat resolution
    this.config.onCombatResolution?.(this.state);

    // Phase 7: Siege progress
    this.config.onSiegeProgress?.(this.state);

    // Phase 8: Persistence (save to database)
    this.config.onPersistence?.(this.state);

    // Phase 9: Broadcast state
    this.config.onBroadcastState?.(this.state);
  }

  /**
   * Process resource production for all territories
   * Each territory generates food and production based on base values
   * Active effects can modify production rates
   */
  private processResourceProduction(): void {
    for (const territory of this.state.territories.values()) {
      if (!territory.owner) continue;

      const faction = this.state.factions.get(territory.owner);
      if (!faction) continue;

      // Calculate effect multipliers
      let foodMultiplier = 1;
      let productionMultiplier = 1;
      for (const effect of territory.activeEffects) {
        if (effect.modifier.foodMultiplier) {
          foodMultiplier *= effect.modifier.foodMultiplier;
        }
        if (effect.modifier.productionMultiplier) {
          productionMultiplier *= effect.modifier.productionMultiplier;
        }
      }

      // Base production rates with effect multipliers applied
      const foodProduced = Math.floor(territory.food * 0.1 * foodMultiplier);
      const productionProduced = Math.floor(territory.production * 0.1 * productionMultiplier);

      faction.resources.food += foodProduced;
      faction.resources.production += productionProduced;
    }
  }

  /**
   * Process population growth for all territories
   * Growth if food surplus, shrink if deficit, cap at territory limit
   */
  private processPopulationGrowth(): void {
    const POPULATION_CAP = 1000;
    const GROWTH_RATE = 0.02; // 2% growth per tick
    const FOOD_PER_POP = 0.1; // Food consumed per population

    for (const territory of this.state.territories.values()) {
      if (!territory.owner) continue;

      const faction = this.state.factions.get(territory.owner);
      if (!faction) continue;

      // Calculate food consumption
      const foodConsumed = Math.floor(territory.population * FOOD_PER_POP);

      if (faction.resources.food >= foodConsumed) {
        // Food surplus - population grows
        faction.resources.food -= foodConsumed;
        const growth = Math.floor(territory.population * GROWTH_RATE);
        territory.population = Math.min(POPULATION_CAP, territory.population + growth);
      } else {
        // Food deficit - population shrinks
        const deficit = foodConsumed - faction.resources.food;
        faction.resources.food = 0;
        const shrink = Math.floor(deficit / FOOD_PER_POP);
        territory.population = Math.max(0, territory.population - shrink);
      }
    }
  }

  /**
   * Process divine power regeneration for all factions
   * +1 divine power per tick per temple building
   */
  private processDivinePowerRegen(): void {
    for (const faction of this.state.factions.values()) {
      // Count temples in faction's territories
      let templeCount = 0;
      for (const territoryId of faction.territories) {
        const territory = this.state.territories.get(territoryId);
        if (territory && territory.buildings.includes('temple')) {
          templeCount++;
        }
      }

      // Base regeneration (minimum 1 even without temples)
      const baseRegen = 1;
      const templeRegen = templeCount * DIVINE_POWER_REGEN_PER_TEMPLE;
      const totalRegen = baseRegen + templeRegen;

      // Apply regeneration (cap at max)
      faction.divinePower = Math.min(DIVINE_POWER_MAX, faction.divinePower + totalRegen);
    }
  }

  /**
   * Process expiration of active effects on territories
   * Remove effects when currentTick >= effect.expiresTick
   */
  private processEffectExpiration(): void {
    for (const territory of this.state.territories.values()) {
      if (territory.activeEffects.length === 0) continue;

      // Filter out expired effects
      const activeEffects = territory.activeEffects.filter(
        (effect) => effect.expiresTick > this.state.tick
      );

      // Log expired effects
      const expiredCount = territory.activeEffects.length - activeEffects.length;
      if (expiredCount > 0) {
        console.log(`[Effects] ${expiredCount} effects expired on territory ${territory.id}`);
      }

      territory.activeEffects = activeEffects;
    }
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Check if ticker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current tick count
   */
  getCurrentTick(): number {
    return this.state.tick;
  }
}

/**
 * Create initial game state
 */
export function createInitialGameState(): GameState {
  return {
    tick: 0,
    territories: new Map(),
    factions: new Map(),
    pendingBattles: [],
    sieges: new Map(),
  };
}
