/**
 * Highlights System for Pantheon
 * Detects interesting moments and generates highlight reels
 */

import {
  GameEvent,
  GameEventType,
  GameState,
  HighlightCategory,
  HighlightDetection,
  Highlight,
  HighlightReel,
  SpectatorLink,
  HIGHLIGHT_SCORE_WEIGHTS,
  HIGHLIGHT_THRESHOLDS,
} from '@pantheon/shared';
import {
  DbHighlight,
  DbHighlightInsert,
  DbHighlightReel,
  DbHighlightReelInsert,
  DbSpectatorLink,
  DbSpectatorLinkInsert,
  DbHighlightVote,
  DbHighlightVoteInsert,
} from '../db/types.js';
import { supabase } from '../db/supabase.js';

// ============================================================================
// HIGHLIGHT DETECTION
// ============================================================================

/**
 * Analyze an event and determine if it should be a highlight
 */
export function analyzeEvent(
  event: GameEvent,
  state: GameState,
  recentEvents: GameEvent[],
  seasonEndTick?: number
): HighlightDetection | null {
  const baseScore = getBaseScore(event.eventType);
  if (baseScore === 0) return null;

  const multipliers: { name: string; value: number }[] = [];
  let finalScore = baseScore;

  // Get faction info
  const subjectFaction = event.subjectId ? state.factions.get(event.subjectId) : null;
  const targetFaction = event.targetId
    ? state.factions.get(event.targetId)
    : null;

  // Check for underdog victory (small faction beats large)
  if (
    subjectFaction &&
    targetFaction &&
    isConflictEvent(event.eventType)
  ) {
    const subjectStrength = subjectFaction.territories.length;
    const targetStrength = targetFaction.territories.length;

    if (subjectStrength < targetStrength * 0.5) {
      multipliers.push({ name: 'underdog', value: HIGHLIGHT_SCORE_WEIGHTS.underdogMultiplier });
      finalScore *= HIGHLIGHT_SCORE_WEIGHTS.underdogMultiplier;
    }
  }

  // Check for comeback (faction was nearly eliminated)
  if (subjectFaction && isVictoryEvent(event.eventType)) {
    const wasNearDeath = (event.data as Record<string, unknown>).wasNearElimination;
    if (wasNearDeath || subjectFaction.territories.length <= 2) {
      multipliers.push({ name: 'comeback', value: HIGHLIGHT_SCORE_WEIGHTS.comebackMultiplier });
      finalScore *= HIGHLIGHT_SCORE_WEIGHTS.comebackMultiplier;
    }
  }

  // Check for event clustering (multiple significant events close together)
  const clusterEvents = recentEvents.filter(
    (e) =>
      Math.abs(e.tick - event.tick) <= HIGHLIGHT_THRESHOLDS.clusterWindowTicks &&
      getBaseScore(e.eventType) >= HIGHLIGHT_THRESHOLDS.minScore
  );
  if (clusterEvents.length >= 3) {
    multipliers.push({ name: 'cluster', value: HIGHLIGHT_SCORE_WEIGHTS.clusterBonus });
    finalScore *= HIGHLIGHT_SCORE_WEIGHTS.clusterBonus;
  }

  // Check for dramatic timing (near season end)
  if (seasonEndTick && seasonEndTick - event.tick <= 3600) {
    // Within 1 hour of season end
    multipliers.push({ name: 'dramatic_timing', value: HIGHLIGHT_SCORE_WEIGHTS.dramaticTimingBonus });
    finalScore *= HIGHLIGHT_SCORE_WEIGHTS.dramaticTimingBonus;
  }

  // Add casualty-based scoring for battles
  const casualties = (event.data as Record<string, number>).casualties || 0;
  if (casualties > 0) {
    const casualtyBonus = 1 + (casualties / 100) * HIGHLIGHT_SCORE_WEIGHTS.casualtyScaling;
    multipliers.push({ name: 'casualties', value: casualtyBonus });
    finalScore *= casualtyBonus;
  }

  // Check minimum score threshold
  if (finalScore < HIGHLIGHT_THRESHOLDS.minScore) {
    return null;
  }

  // Determine category
  const category = getEventCategory(event.eventType);

  // Generate title and description
  const { title, description } = generateHighlightText(event, state);

  // Collect involved factions
  const factions: HighlightDetection['factions'] = [];
  if (subjectFaction) {
    factions.push({ id: subjectFaction.id, name: subjectFaction.name, role: 'subject' });
  }
  if (targetFaction) {
    factions.push({ id: targetFaction.id, name: targetFaction.name, role: 'target' });
  }

  return {
    tick: event.tick,
    eventType: event.eventType,
    baseScore,
    multipliers,
    finalScore,
    category,
    title,
    description,
    factions,
    metadata: event.data,
  };
}

/**
 * Get base score for an event type
 */
function getBaseScore(eventType: GameEventType): number {
  return (HIGHLIGHT_SCORE_WEIGHTS as Record<string, number>)[eventType] || 0;
}

/**
 * Check if event is a conflict event
 */
function isConflictEvent(eventType: GameEventType): boolean {
  return [
    'territory_captured',
    'siege_completed',
    'battle_resolved',
    'faction_eliminated',
  ].includes(eventType);
}

/**
 * Check if event is a victory event
 */
function isVictoryEvent(eventType: GameEventType): boolean {
  return [
    'territory_captured',
    'siege_completed',
    'faction_eliminated',
    'dominance_started',
  ].includes(eventType);
}

/**
 * Get category for an event type
 */
function getEventCategory(eventType: GameEventType): HighlightCategory {
  const categoryMap: Record<string, HighlightCategory> = {
    territory_captured: 'conquest',
    siege_completed: 'conquest',
    siege_started: 'conquest',
    faction_eliminated: 'elimination',
    war_declared: 'diplomacy',
    alliance_formed: 'diplomacy',
    alliance_broken: 'diplomacy',
    peace_accepted: 'diplomacy',
    battle_resolved: 'battle',
    champion_spawned: 'champion',
    champion_died: 'champion',
    champion_blessed: 'champion',
    miracle_cast: 'divine',
    dominance_started: 'dominance',
    season_ended: 'general',
  };
  return categoryMap[eventType] || 'general';
}

/**
 * Generate title and description for a highlight
 */
function generateHighlightText(
  event: GameEvent,
  state: GameState
): { title: string; description: string } {
  const subjectFaction = event.subjectId ? state.factions.get(event.subjectId) : null;
  const targetFaction = event.targetId ? state.factions.get(event.targetId) : null;
  const data = event.data as Record<string, unknown>;

  switch (event.eventType) {
    case 'territory_captured':
      return {
        title: `${subjectFaction?.name || 'Unknown'} Conquers Territory`,
        description: `${subjectFaction?.name || 'A faction'} has captured territory from ${targetFaction?.name || 'another faction'}.`,
      };

    case 'siege_completed':
      return {
        title: `Siege Victory: ${subjectFaction?.name || 'Unknown'}`,
        description: `After a lengthy siege, ${subjectFaction?.name || 'a faction'} has taken control of enemy territory.`,
      };

    case 'faction_eliminated':
      return {
        title: `${subjectFaction?.name || 'A Faction'} Has Fallen`,
        description: `${subjectFaction?.name || 'A once-mighty faction'} has been eliminated from the game.`,
      };

    case 'war_declared':
      return {
        title: `War Declared!`,
        description: `${subjectFaction?.name || 'A faction'} has declared war on ${targetFaction?.name || 'another faction'}.`,
      };

    case 'alliance_formed':
      return {
        title: `New Alliance Formed`,
        description: `${subjectFaction?.name || 'A faction'} and ${targetFaction?.name || 'another faction'} have formed an alliance.`,
      };

    case 'alliance_broken':
      return {
        title: `Betrayal! Alliance Broken`,
        description: `${subjectFaction?.name || 'A faction'} has broken their alliance with ${targetFaction?.name || 'their ally'}.`,
      };

    case 'champion_died':
      const championName = data.name as string || 'A champion';
      return {
        title: `The Fall of ${championName}`,
        description: `${championName}, champion of ${subjectFaction?.name || 'their faction'}, has met their end.`,
      };

    case 'dominance_started':
      return {
        title: `${subjectFaction?.name || 'A Faction'} Achieves Dominance`,
        description: `${subjectFaction?.name || 'A faction'} now controls over 60% of all territories!`,
      };

    case 'miracle_cast':
      const miracleName = data.miracleName as string || 'a miracle';
      return {
        title: `Divine Intervention: ${miracleName}`,
        description: `${subjectFaction?.name || 'A deity'} has cast ${miracleName}.`,
      };

    default:
      return {
        title: `Notable Event`,
        description: `Something significant has happened in the world.`,
      };
  }
}

// ============================================================================
// HIGHLIGHT PERSISTENCE
// ============================================================================

/**
 * Repository for highlights
 */
export const highlightRepo = {
  async create(highlight: DbHighlightInsert): Promise<DbHighlight | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('highlights')
      .insert(highlight)
      .select()
      .single();
    if (error) {
      console.error('[Highlights] Create error:', error);
      return null;
    }
    return data;
  },

  async getById(id: string): Promise<DbHighlight | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async getByShard(
    shardId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<DbHighlight[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .eq('shard_id', shardId)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return [];
    return data || [];
  },

  async getBySeason(
    seasonId: string,
    limit: number = 50
  ): Promise<DbHighlight[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .eq('season_id', seasonId)
      .order('score', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  },

  async getTopHighlights(limit: number = 10): Promise<DbHighlight[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .order('score', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  },

  async getFeatured(): Promise<DbHighlight[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .eq('is_featured', true)
      .order('score', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async getEternalCanon(): Promise<DbHighlight[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('highlights')
      .select()
      .eq('is_eternal_canon', true)
      .order('score', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async incrementViews(id: string): Promise<void> {
    if (!supabase) return;
    await supabase.rpc('increment_highlight_views', { highlight_id: id });
  },

  async incrementShares(id: string): Promise<void> {
    if (!supabase) return;
    await supabase.rpc('increment_highlight_shares', { highlight_id: id });
  },

  async setFeatured(id: string, featured: boolean): Promise<void> {
    if (!supabase) return;
    await supabase
      .from('highlights')
      .update({ is_featured: featured })
      .eq('id', id);
  },

  async setEternalCanon(id: string, eternal: boolean): Promise<void> {
    if (!supabase) return;
    await supabase
      .from('highlights')
      .update({ is_eternal_canon: eternal })
      .eq('id', id);
  },
};

/**
 * Repository for highlight votes
 */
export const highlightVoteRepo = {
  async vote(
    highlightId: string,
    deityId: string,
    voteType: 'up' | 'down'
  ): Promise<DbHighlightVote | null> {
    if (!supabase) return null;

    // Upsert vote (update if exists, insert if not)
    const { data, error } = await supabase
      .from('highlight_votes')
      .upsert(
        { highlight_id: highlightId, deity_id: deityId, vote_type: voteType },
        { onConflict: 'highlight_id,deity_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Highlights] Vote error:', error);
      return null;
    }
    return data;
  },

  async removeVote(highlightId: string, deityId: string): Promise<void> {
    if (!supabase) return;
    await supabase
      .from('highlight_votes')
      .delete()
      .eq('highlight_id', highlightId)
      .eq('deity_id', deityId);
  },

  async getVote(highlightId: string, deityId: string): Promise<DbHighlightVote | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('highlight_votes')
      .select()
      .eq('highlight_id', highlightId)
      .eq('deity_id', deityId)
      .single();
    return data;
  },
};

/**
 * Repository for highlight reels
 */
export const highlightReelRepo = {
  async create(reel: DbHighlightReelInsert): Promise<DbHighlightReel | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('highlight_reels')
      .insert(reel)
      .select()
      .single();
    if (error) {
      console.error('[Highlights] Reel create error:', error);
      return null;
    }
    return data;
  },

  async getById(id: string): Promise<DbHighlightReel | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('highlight_reels')
      .select()
      .eq('id', id)
      .single();
    return data;
  },

  async getBySeason(seasonId: string): Promise<DbHighlightReel[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('highlight_reels')
      .select()
      .eq('season_id', seasonId)
      .eq('is_public', true)
      .order('view_count', { ascending: false });
    return data || [];
  },

  async getFeatured(): Promise<DbHighlightReel[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('highlight_reels')
      .select()
      .eq('is_featured', true)
      .order('view_count', { ascending: false });
    return data || [];
  },
};

/**
 * Repository for spectator links
 */
export const spectatorLinkRepo = {
  async create(link: DbSpectatorLinkInsert): Promise<DbSpectatorLink | null> {
    if (!supabase) return null;

    // Generate unique code
    const { data: codeData } = await supabase.rpc('generate_spectator_code');
    const code = codeData || generateLocalCode();

    const { data, error } = await supabase
      .from('spectator_links')
      .insert({ ...link, code })
      .select()
      .single();

    if (error) {
      console.error('[Highlights] Spectator link create error:', error);
      return null;
    }
    return data;
  },

  async getByCode(code: string): Promise<DbSpectatorLink | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('spectator_links')
      .select()
      .eq('code', code)
      .single();
    return data;
  },

  async incrementViews(code: string): Promise<void> {
    if (!supabase) return;
    // First get current count, then increment
    const { data } = await supabase
      .from('spectator_links')
      .select('view_count')
      .eq('code', code)
      .single();

    if (data) {
      await supabase
        .from('spectator_links')
        .update({ view_count: data.view_count + 1 })
        .eq('code', code);
    }
  },
};

/**
 * Generate a local fallback code
 */
function generateLocalCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// HIGHLIGHT REEL GENERATION
// ============================================================================

/**
 * Generate an automatic highlight reel for a season
 */
export async function generateSeasonHighlightReel(
  seasonId: string,
  shardId: string
): Promise<HighlightReel | null> {
  // Get top highlights for the season
  const highlights = await highlightRepo.getBySeason(
    seasonId,
    HIGHLIGHT_THRESHOLDS.maxHighlightsPerReel
  );

  if (highlights.length < HIGHLIGHT_THRESHOLDS.reelMinHighlights) {
    console.log('[Highlights] Not enough highlights for reel generation');
    return null;
  }

  // Create the reel
  const reelData: DbHighlightReelInsert = {
    shard_id: shardId,
    season_id: seasonId,
    title: `Season Highlights`,
    description: `Top ${highlights.length} moments from this season`,
    highlight_ids: highlights.map((h) => h.id),
    reel_type: 'auto',
    creator_deity_id: null,
    is_public: true,
  };

  const reel = await highlightReelRepo.create(reelData);
  if (!reel) return null;

  return dbHighlightReelToHighlightReel(reel);
}

/**
 * Generate an Eternal Canon reel from top moments across all seasons
 */
export async function generateEternalCanonReel(): Promise<HighlightReel | null> {
  const eternalHighlights = await highlightRepo.getEternalCanon();

  if (eternalHighlights.length === 0) {
    return null;
  }

  const reelData: DbHighlightReelInsert = {
    shard_id: null,
    season_id: null,
    title: `Eternal Canon`,
    description: `The greatest moments in Pantheon history`,
    highlight_ids: eternalHighlights.map((h) => h.id),
    reel_type: 'curated',
    creator_deity_id: null,
    is_public: true,
  };

  const reel = await highlightReelRepo.create(reelData);
  if (!reel) return null;

  return dbHighlightReelToHighlightReel(reel);
}

// ============================================================================
// SPECTATOR LINK CREATION
// ============================================================================

/**
 * Create a spectator link for a specific moment
 */
export async function createSpectatorLink(
  shardId: string,
  startTick: number,
  options: {
    endTick?: number;
    title?: string;
    description?: string;
    creatorDeityId?: string;
    seasonId?: string;
    expiresInHours?: number;
  } = {}
): Promise<SpectatorLink | null> {
  const linkData: DbSpectatorLinkInsert = {
    shard_id: shardId,
    season_id: options.seasonId || null,
    start_tick: startTick,
    end_tick: options.endTick || null,
    title: options.title || null,
    description: options.description || null,
    creator_deity_id: options.creatorDeityId || null,
    code: '', // Will be generated by repo
    expires_at: options.expiresInHours
      ? new Date(Date.now() + options.expiresInHours * 3600 * 1000).toISOString()
      : null,
  };

  const link = await spectatorLinkRepo.create(linkData);
  if (!link) return null;

  return dbSpectatorLinkToSpectatorLink(link);
}

/**
 * Get a spectator link by its share code
 */
export async function getSpectatorLink(code: string): Promise<SpectatorLink | null> {
  const link = await spectatorLinkRepo.getByCode(code);
  if (!link) return null;

  // Check expiration
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return null;
  }

  // Increment views
  await spectatorLinkRepo.incrementViews(code);

  return dbSpectatorLinkToSpectatorLink(link);
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

function dbHighlightToHighlight(db: DbHighlight): Highlight {
  return {
    id: db.id,
    shardId: db.shard_id,
    seasonId: db.season_id || undefined,
    tick: db.tick,
    eventType: db.event_type,
    title: db.title,
    description: db.description || undefined,
    score: db.score,
    category: db.category,
    highlightData: db.highlight_data,
    eventIds: db.event_ids,
    viewCount: db.view_count,
    shareCount: db.share_count,
    voteScore: db.vote_score,
    isFeatured: db.is_featured,
    isEternalCanon: db.is_eternal_canon,
    createdAt: new Date(db.created_at).getTime(),
  };
}

function dbHighlightReelToHighlightReel(db: DbHighlightReel): HighlightReel {
  return {
    id: db.id,
    shardId: db.shard_id || undefined,
    seasonId: db.season_id || undefined,
    title: db.title,
    description: db.description || undefined,
    highlightIds: db.highlight_ids,
    reelType: db.reel_type,
    creatorDeityId: db.creator_deity_id || undefined,
    viewCount: db.view_count,
    shareCount: db.share_count,
    isFeatured: db.is_featured,
    isPublic: db.is_public,
    createdAt: new Date(db.created_at).getTime(),
  };
}

function dbSpectatorLinkToSpectatorLink(db: DbSpectatorLink): SpectatorLink {
  return {
    id: db.id,
    code: db.code,
    shardId: db.shard_id,
    seasonId: db.season_id || undefined,
    startTick: db.start_tick,
    endTick: db.end_tick || undefined,
    title: db.title || undefined,
    description: db.description || undefined,
    creatorDeityId: db.creator_deity_id || undefined,
    viewCount: db.view_count,
    expiresAt: db.expires_at ? new Date(db.expires_at).getTime() : undefined,
    createdAt: new Date(db.created_at).getTime(),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Process events and detect highlights
 */
export async function processHighlights(
  events: GameEvent[],
  state: GameState,
  shardId: string,
  seasonId?: string,
  seasonEndTick?: number
): Promise<Highlight[]> {
  const highlights: Highlight[] = [];

  for (const event of events) {
    const detection = analyzeEvent(event, state, events, seasonEndTick);
    if (!detection) continue;

    // Create highlight in database
    const highlightData: DbHighlightInsert = {
      shard_id: shardId,
      season_id: seasonId || null,
      tick: detection.tick,
      event_type: detection.eventType,
      title: detection.title,
      description: detection.description,
      score: detection.finalScore,
      category: detection.category,
      highlight_data: detection.metadata,
      event_ids: [event.id],
    };

    const created = await highlightRepo.create(highlightData);
    if (created) {
      highlights.push(dbHighlightToHighlight(created));
    }
  }

  return highlights;
}

/**
 * Vote on a highlight
 */
export async function voteOnHighlight(
  highlightId: string,
  deityId: string,
  voteType: 'up' | 'down'
): Promise<{ success: boolean; error?: string }> {
  const vote = await highlightVoteRepo.vote(highlightId, deityId, voteType);
  if (!vote) {
    return { success: false, error: 'Failed to record vote' };
  }

  // Check if highlight should be promoted to eternal canon
  const highlight = await highlightRepo.getById(highlightId);
  if (
    highlight &&
    !highlight.is_eternal_canon &&
    highlight.score >= HIGHLIGHT_THRESHOLDS.eternalCanonScore &&
    highlight.vote_score >= HIGHLIGHT_THRESHOLDS.eternalCanonVotes
  ) {
    await highlightRepo.setEternalCanon(highlightId, true);
  }

  return { success: true };
}

/**
 * Get highlights for display
 */
export async function getHighlights(options: {
  shardId?: string;
  seasonId?: string;
  featured?: boolean;
  eternalCanon?: boolean;
  limit?: number;
}): Promise<Highlight[]> {
  let dbHighlights: DbHighlight[] = [];

  if (options.eternalCanon) {
    dbHighlights = await highlightRepo.getEternalCanon();
  } else if (options.featured) {
    dbHighlights = await highlightRepo.getFeatured();
  } else if (options.seasonId) {
    dbHighlights = await highlightRepo.getBySeason(options.seasonId, options.limit);
  } else if (options.shardId) {
    dbHighlights = await highlightRepo.getByShard(options.shardId, options.limit);
  } else {
    dbHighlights = await highlightRepo.getTopHighlights(options.limit);
  }

  return dbHighlights.map(dbHighlightToHighlight);
}
