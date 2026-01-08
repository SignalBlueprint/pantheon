/**
 * Game loop / ticker system for Pantheon
 * Manages the world tick cycle and dispatches to subsystems
 */

import { GameState, Territory, Faction, TICK_RATE_MS } from '@pantheon/shared';

// Tick phase callbacks
export type TickPhase = (state: GameState) => void;

export interface TickerConfig {
  tickRate?: number;
  onResourceProduction?: TickPhase;
  onPopulationGrowth?: TickPhase;
  onAIDecisions?: TickPhase;
  onCombatResolution?: TickPhase;
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
   * Phases: 1) Resource production, 2) Population growth, 3) AI decisions,
   *         4) Combat resolution, 5) Broadcast state
   */
  tick(): void {
    this.state.tick++;

    // Phase 1: Resource production
    this.config.onResourceProduction?.(this.state);
    this.processResourceProduction();

    // Phase 2: Population growth
    this.config.onPopulationGrowth?.(this.state);
    this.processPopulationGrowth();

    // Phase 3: AI decisions
    this.config.onAIDecisions?.(this.state);

    // Phase 4: Combat resolution
    this.config.onCombatResolution?.(this.state);

    // Phase 5: Broadcast state
    this.config.onBroadcastState?.(this.state);
  }

  /**
   * Process resource production for all territories
   * Each territory generates food and production based on base values
   */
  private processResourceProduction(): void {
    for (const territory of this.state.territories.values()) {
      if (!territory.owner) continue;

      const faction = this.state.factions.get(territory.owner);
      if (!faction) continue;

      // Base production rates (can be modified by terrain type later)
      const foodProduced = Math.floor(territory.food * 0.1);
      const productionProduced = Math.floor(territory.production * 0.1);

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
  };
}
