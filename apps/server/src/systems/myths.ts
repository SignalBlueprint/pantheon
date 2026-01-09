/**
 * Mythology System for Pantheon
 * Handles myth generation, trigger detection, and template-based text creation
 */

import {
  GameState,
  Faction,
  Territory,
  Myth,
  MythEventType,
  MythTemplate,
  MYTH_BATTLE_CASUALTY_THRESHOLD,
  MYTH_DOMINANCE_THRESHOLD,
} from '@pantheon/shared';
import { mythRepo, mythTemplateRepo } from '../db/repositories.js';
import { DbMythInsert } from '../db/types.js';

// Cache templates in memory for performance
let templateCache: Map<MythEventType, MythTemplate[]> = new Map();
let templateCacheLoaded = false;

// Adjective pools for template generation
const ADJECTIVES = {
  battle: ['bloody', 'glorious', 'terrible', 'legendary', 'fateful', 'epic', 'decisive', 'fierce'],
  positive: ['blessed', 'sacred', 'divine', 'magnificent', 'triumphant', 'grand', 'glorious'],
  negative: ['dark', 'treacherous', 'bitter', 'shameful', 'devastating', 'cruel', 'terrible'],
  terrain: ['ancient', 'windswept', 'sun-scorched', 'fertile', 'barren', 'mystical', 'fabled'],
};

// Fallback templates if database templates are not available
const FALLBACK_TEMPLATES: Record<MythEventType, MythTemplate[]> = {
  great_battle: [
    {
      id: 'fb_battle_1',
      eventType: 'great_battle',
      templateText: 'In the {adjective} fields of {location}, the armies of {faction} clashed against {enemy_faction}. {casualty_count} souls were claimed that day.',
      titleTemplate: 'The Battle of {location}',
      weight: 1,
    },
  ],
  divine_intervention: [
    {
      id: 'fb_divine_1',
      eventType: 'divine_intervention',
      templateText: 'The deity of {faction} bestowed {miracle_name} upon {location}. The faithful knew their prayers had been answered.',
      titleTemplate: 'The Divine {miracle_name}',
      weight: 1,
    },
  ],
  hero_death: [
    {
      id: 'fb_hero_1',
      eventType: 'hero_death',
      templateText: 'The great {hero_name} of {faction} fell in battle at {location}. Their legend shall echo through eternity.',
      titleTemplate: 'The Fall of {hero_name}',
      weight: 1,
    },
  ],
  city_founding: [
    {
      id: 'fb_city_1',
      eventType: 'city_founding',
      templateText: 'In the {adjective} lands of {location}, the people of {faction} established a new settlement.',
      titleTemplate: 'The Founding of {location}',
      weight: 1,
    },
  ],
  betrayal: [
    {
      id: 'fb_betrayal_1',
      eventType: 'betrayal',
      templateText: 'The alliance between {faction} and {betrayed_faction} was shattered. Trust, once broken, can never be restored.',
      titleTemplate: 'The {adjective} Betrayal',
      weight: 1,
    },
  ],
  siege_victory: [
    {
      id: 'fb_siege_1',
      eventType: 'siege_victory',
      templateText: 'After {siege_duration} days, the walls of {location} fell to {faction}. A new era had dawned.',
      titleTemplate: 'The Fall of {location}',
      weight: 1,
    },
  ],
  dominance_achieved: [
    {
      id: 'fb_dominance_1',
      eventType: 'dominance_achieved',
      templateText: 'The {faction} rose above all others, commanding {territory_percent}% of the known world.',
      titleTemplate: 'The Age of {faction}',
      weight: 1,
    },
  ],
  miracle_smite: [
    {
      id: 'fb_smite_1',
      eventType: 'miracle_smite',
      templateText: 'Divine wrath fell upon {location} when the god of {faction} struck down {enemy_faction}.',
      titleTemplate: 'Divine Judgment at {location}',
      weight: 1,
    },
  ],
};

/**
 * Load templates from database into cache
 */
async function loadTemplates(): Promise<void> {
  if (templateCacheLoaded) return;

  try {
    const templates = await mythTemplateRepo.getAll();
    templateCache.clear();

    for (const template of templates) {
      const eventType = template.event_type as MythEventType;
      if (!templateCache.has(eventType)) {
        templateCache.set(eventType, []);
      }
      templateCache.get(eventType)!.push({
        id: template.id,
        eventType,
        templateText: template.template_text,
        titleTemplate: template.title_template,
        weight: template.weight,
      });
    }

    templateCacheLoaded = true;
    console.log(`[Myths] Loaded ${templates.length} myth templates`);
  } catch (error) {
    console.error('[Myths] Failed to load templates from database:', error);
    // Use fallback templates
    for (const [eventType, templates] of Object.entries(FALLBACK_TEMPLATES)) {
      templateCache.set(eventType as MythEventType, templates);
    }
    templateCacheLoaded = true;
  }
}

/**
 * Select a random template for an event type using weighted selection
 */
function selectTemplate(eventType: MythEventType): MythTemplate | null {
  const templates = templateCache.get(eventType) || FALLBACK_TEMPLATES[eventType] || [];
  if (templates.length === 0) return null;

  // Weighted random selection
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const template of templates) {
    random -= template.weight;
    if (random <= 0) {
      return template;
    }
  }

  return templates[0];
}

/**
 * Get a random adjective from a category
 */
function getRandomAdjective(category: keyof typeof ADJECTIVES): string {
  const adjectives = ADJECTIVES[category];
  return adjectives[Math.floor(Math.random() * adjectives.length)];
}

/**
 * Fill in template placeholders with actual values
 */
function fillTemplate(template: string, variables: Record<string, string | number>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, String(value));
  }

  // Fill any remaining {adjective} with random battle adjective
  result = result.replace(/\{adjective\}/g, () => getRandomAdjective('battle'));

  return result;
}

/**
 * Generate a myth from an event
 */
export async function generateMyth(
  shardId: string,
  factionId: string,
  eventType: MythEventType,
  eventData: Record<string, unknown>,
  tick: number
): Promise<Myth | null> {
  await loadTemplates();

  const template = selectTemplate(eventType);
  if (!template) {
    console.warn(`[Myths] No template found for event type: ${eventType}`);
    return null;
  }

  // Build variable map from event data
  const variables: Record<string, string | number> = {
    ...eventData as Record<string, string | number>,
    tick: tick.toString(),
  };

  // Generate text from template
  const generatedText = fillTemplate(template.templateText, variables);
  const title = fillTemplate(template.titleTemplate, variables);

  // Determine if myth is notable (battles with high casualties, etc.)
  const isNotable = determineNotability(eventType, eventData);

  // Save to database
  try {
    const mythInsert: DbMythInsert = {
      shard_id: shardId,
      faction_id: factionId,
      event_type: eventType,
      event_data: eventData,
      generated_text: generatedText,
      title,
      tick_created: tick,
      is_notable: isNotable,
    };

    const dbMyth = await mythRepo.create(mythInsert);

    console.log(`[Myths] Created ${isNotable ? 'notable ' : ''}myth: "${title}"`);

    return {
      id: dbMyth.id,
      shardId: dbMyth.shard_id,
      factionId: dbMyth.faction_id,
      eventType: dbMyth.event_type,
      eventData: dbMyth.event_data,
      generatedText: dbMyth.generated_text,
      title: dbMyth.title,
      tickCreated: dbMyth.tick_created,
      isNotable: dbMyth.is_notable,
      views: dbMyth.views,
      shares: dbMyth.shares,
      createdAt: new Date(dbMyth.created_at).getTime(),
    };
  } catch (error) {
    console.error('[Myths] Failed to create myth:', error);
    return null;
  }
}

/**
 * Determine if a myth should be marked as notable
 */
function determineNotability(eventType: MythEventType, eventData: Record<string, unknown>): boolean {
  switch (eventType) {
    case 'great_battle':
      // Notable if casualties exceed 2x threshold
      const casualties = (eventData.casualty_count as number) || 0;
      return casualties >= MYTH_BATTLE_CASUALTY_THRESHOLD * 2;

    case 'dominance_achieved':
      // Always notable
      return true;

    case 'divine_intervention':
      // Notable if high-power miracle
      const miracleCost = (eventData.miracle_cost as number) || 0;
      return miracleCost >= 50;

    case 'hero_death':
      // Notable if hero was blessed
      return (eventData.was_blessed as boolean) || false;

    case 'betrayal':
      // Notable if longtime alliance
      return (eventData.alliance_duration as number) > 3600 * 24; // > 24 hours

    case 'siege_victory':
      // Notable if long siege
      return (eventData.siege_duration as number) > 3600 * 12; // > 12 hours

    default:
      return false;
  }
}

// ============== TRIGGER DETECTION ==============

/**
 * Check for great battle myth trigger
 * Called after a battle resolves
 */
export function checkBattleMythTrigger(
  state: GameState,
  attackerFaction: Faction,
  defenderFaction: Faction,
  territory: Territory,
  casualties: number,
  attackerWon: boolean
): void {
  if (casualties < MYTH_BATTLE_CASUALTY_THRESHOLD) return;
  if (!state.shardId) return;

  const winner = attackerWon ? attackerFaction : defenderFaction;
  const loser = attackerWon ? defenderFaction : attackerFaction;

  const eventData = {
    faction: winner.name,
    enemy_faction: loser.name,
    location: `Territory ${territory.q},${territory.r}`,
    casualty_count: casualties,
    battle_outcome: attackerWon ? 'victory' : 'defense',
    victor: winner.name,
    terrain: 'fields',
    adjective: getRandomAdjective('battle'),
  };

  // Generate myth for winner
  generateMyth(state.shardId, winner.id, 'great_battle', eventData, state.tick);
}

/**
 * Check for divine intervention myth trigger
 * Called after a miracle is cast
 */
export function checkMiracleMythTrigger(
  state: GameState,
  faction: Faction,
  territory: Territory,
  miracleName: string,
  miracleCost: number
): void {
  if (!state.shardId) return;

  // Only generate myth for significant miracles (cost >= 30)
  if (miracleCost < 30) return;

  const eventData = {
    faction: faction.name,
    location: `Territory ${territory.q},${territory.r}`,
    miracle_name: miracleName,
    miracle_cost: miracleCost,
    affected_element: 'land',
    adjective: getRandomAdjective('positive'),
  };

  generateMyth(state.shardId, faction.id, 'divine_intervention', eventData, state.tick);
}

/**
 * Check for siege victory myth trigger
 * Called after a siege completes
 */
export function checkSiegeMythTrigger(
  state: GameState,
  attackerFaction: Faction,
  defenderFaction: Faction,
  territory: Territory,
  siegeDurationTicks: number
): void {
  if (!state.shardId) return;

  // Convert ticks to hours for display
  const siegeDurationHours = Math.floor(siegeDurationTicks / 3600);

  const eventData = {
    faction: attackerFaction.name,
    defender_faction: defenderFaction.name,
    location: `Territory ${territory.q},${territory.r}`,
    siege_duration: siegeDurationHours,
    adjective: getRandomAdjective('battle'),
  };

  generateMyth(state.shardId, attackerFaction.id, 'siege_victory', eventData, state.tick);
}

/**
 * Check for betrayal myth trigger
 * Called when an alliance is broken
 */
export function checkBetrayalMythTrigger(
  state: GameState,
  betrayerFaction: Faction,
  betrayedFaction: Faction,
  allianceDurationTicks: number
): void {
  if (!state.shardId) return;

  const eventData = {
    faction: betrayerFaction.name,
    betrayed_faction: betrayedFaction.name,
    betrayer: betrayerFaction.name,
    alliance_duration: allianceDurationTicks,
    consequence: 'Eternal enmity',
    adjective: getRandomAdjective('negative'),
  };

  // Generate myth for both factions
  generateMyth(state.shardId, betrayerFaction.id, 'betrayal', eventData, state.tick);
  generateMyth(state.shardId, betrayedFaction.id, 'betrayal', eventData, state.tick);
}

/**
 * Check for dominance myth trigger
 * Called when a faction achieves dominance threshold
 */
export function checkDominanceMythTrigger(
  state: GameState,
  faction: Faction,
  territoryPercent: number
): void {
  if (!state.shardId) return;

  const eventData = {
    faction: faction.name,
    territory_percent: Math.round(territoryPercent * 100),
    territory_count: faction.territories.length,
    adjective: getRandomAdjective('positive'),
  };

  generateMyth(state.shardId, faction.id, 'dominance_achieved', eventData, state.tick);
}

/**
 * Check for city founding myth trigger
 * Called when a faction claims a new territory
 */
export function checkCityFoundingMythTrigger(
  state: GameState,
  faction: Faction,
  territory: Territory
): void {
  if (!state.shardId) return;

  // Only generate myth for significant territory claims (every 5th territory)
  if (faction.territories.length % 5 !== 0) return;

  const eventData = {
    faction: faction.name,
    location: `Territory ${territory.q},${territory.r}`,
    terrain: 'lands',
    adjective: getRandomAdjective('terrain'),
  };

  generateMyth(state.shardId, faction.id, 'city_founding', eventData, state.tick);
}

// ============== API FUNCTIONS ==============

/**
 * Get myths for a faction
 */
export async function getFactionMyths(factionId: string, limit = 50): Promise<Myth[]> {
  const dbMyths = await mythRepo.getByFaction(factionId, limit);
  return dbMyths.map(dbMythToMyth);
}

/**
 * Get all myths for a shard
 */
export async function getShardMyths(shardId: string, limit = 100): Promise<Myth[]> {
  const dbMyths = await mythRepo.getByShard(shardId, limit);
  return dbMyths.map(dbMythToMyth);
}

/**
 * Get notable myths for a shard
 */
export async function getNotableMyths(shardId: string, limit = 20): Promise<Myth[]> {
  const dbMyths = await mythRepo.getNotable(shardId, limit);
  return dbMyths.map(dbMythToMyth);
}

/**
 * Record a myth view
 */
export async function recordMythView(mythId: string): Promise<void> {
  await mythRepo.incrementViews(mythId);
}

/**
 * Record a myth share
 */
export async function recordMythShare(mythId: string): Promise<void> {
  await mythRepo.incrementShares(mythId);
}

/**
 * Convert database myth to API myth
 */
function dbMythToMyth(dbMyth: { id: string; shard_id: string; faction_id: string; event_type: MythEventType; event_data: Record<string, unknown>; generated_text: string; title: string; tick_created: number; is_notable: boolean; views: number; shares: number; created_at: string }): Myth {
  return {
    id: dbMyth.id,
    shardId: dbMyth.shard_id,
    factionId: dbMyth.faction_id,
    eventType: dbMyth.event_type,
    eventData: dbMyth.event_data,
    generatedText: dbMyth.generated_text,
    title: dbMyth.title,
    tickCreated: dbMyth.tick_created,
    isNotable: dbMyth.is_notable,
    views: dbMyth.views,
    shares: dbMyth.shares,
    createdAt: new Date(dbMyth.created_at).getTime(),
  };
}
