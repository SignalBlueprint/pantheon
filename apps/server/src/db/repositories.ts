/**
 * Database repositories for Supabase tables
 * Provides CRUD operations and batch updates
 */

import { supabase, isSupabaseConfigured } from './supabase.js';
import {
  DbShard,
  DbShardInsert,
  DbShardUpdate,
  DbFaction,
  DbFactionInsert,
  DbFactionUpdate,
  DbTerritory,
  DbTerritoryInsert,
  DbTerritoryUpdate,
  DbSiege,
  DbSiegeInsert,
  DbSiegeUpdate,
  DbNotification,
  DbNotificationInsert,
  DbRelation,
  DbRelationInsert,
  DbRelationUpdate,
  DbMessage,
  DbMessageInsert,
  DbDiplomaticEvent,
  DbDiplomaticEventInsert,
  DbSeason,
  DbSeasonInsert,
  DbSeasonUpdate,
  DbLegacy,
  DbLegacyInsert,
  DbSeasonArchive,
  DbSeasonArchiveInsert,
  DbDominanceTracking,
  DbDominanceTrackingInsert,
  DbDominanceTrackingUpdate,
  DbMyth,
  DbMythInsert,
  DbMythUpdate,
  DbMythTemplate,
  DbMythTemplateInsert,
  DbChampion,
  DbChampionInsert,
  DbChampionUpdate,
  DbChampionName,
} from './types.js';

/**
 * Shard repository
 */
export const shardRepo = {
  async getById(id: string): Promise<DbShard | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('shards')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByName(name: string): Promise<DbShard | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('shards')
      .select('*')
      .eq('name', name)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getActive(): Promise<DbShard[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('shards')
      .select('*')
      .eq('status', 'active');
    if (error) throw error;
    return data || [];
  },

  async create(shard: DbShardInsert): Promise<DbShard> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('shards')
      .insert(shard)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbShardUpdate): Promise<DbShard> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('shards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTick(id: string, tick: number): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('shards')
      .update({ current_tick: tick })
      .eq('id', id);
    if (error) throw error;
  },
};

/**
 * Faction repository
 */
export const factionRepo = {
  async getById(id: string): Promise<DbFaction | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('factions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByShard(shardId: string): Promise<DbFaction[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('factions')
      .select('*')
      .eq('shard_id', shardId);
    if (error) throw error;
    return data || [];
  },

  async create(faction: DbFactionInsert): Promise<DbFaction> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('factions')
      .insert(faction)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbFactionUpdate): Promise<DbFaction> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('factions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchUpdate(updates: Array<{ id: string; data: DbFactionUpdate }>): Promise<void> {
    if (!supabase || updates.length === 0) return;
    const db = supabase; // TypeScript narrowing
    // Supabase doesn't support batch updates natively, so we use Promise.all
    await Promise.all(
      updates.map(({ id, data }) =>
        db.from('factions').update(data).eq('id', id)
      )
    );
  },

  async delete(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('factions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

/**
 * Territory repository
 */
export const territoryRepo = {
  async getById(id: string): Promise<DbTerritory | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByShard(shardId: string): Promise<DbTerritory[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .eq('shard_id', shardId);
    if (error) throw error;
    return data || [];
  },

  async getByCoords(shardId: string, q: number, r: number): Promise<DbTerritory | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .eq('shard_id', shardId)
      .eq('q', q)
      .eq('r', r)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(territory: DbTerritoryInsert): Promise<DbTerritory> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('territories')
      .insert(territory)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchCreate(territories: DbTerritoryInsert[]): Promise<DbTerritory[]> {
    if (!supabase || territories.length === 0) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('territories')
      .insert(territories)
      .select();
    if (error) throw error;
    return data || [];
  },

  async update(id: string, updates: DbTerritoryUpdate): Promise<DbTerritory> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('territories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchUpdate(updates: Array<{ id: string; data: DbTerritoryUpdate }>): Promise<void> {
    if (!supabase || updates.length === 0) return;
    const db = supabase; // TypeScript narrowing
    await Promise.all(
      updates.map(({ id, data }) =>
        db.from('territories').update(data).eq('id', id)
      )
    );
  },
};

/**
 * Siege repository
 */
export const siegeRepo = {
  async getById(id: string): Promise<DbSiege | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('sieges')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByShard(shardId: string): Promise<DbSiege[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('sieges')
      .select('*')
      .eq('shard_id', shardId);
    if (error) throw error;
    return data || [];
  },

  async getActive(shardId: string): Promise<DbSiege[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('sieges')
      .select('*')
      .eq('shard_id', shardId)
      .eq('status', 'active');
    if (error) throw error;
    return data || [];
  },

  async getByTerritory(territoryId: string): Promise<DbSiege | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('sieges')
      .select('*')
      .eq('territory_id', territoryId)
      .eq('status', 'active')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(siege: DbSiegeInsert): Promise<DbSiege> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('sieges')
      .insert(siege)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbSiegeUpdate): Promise<DbSiege> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('sieges')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchUpdate(updates: Array<{ id: string; data: DbSiegeUpdate }>): Promise<void> {
    if (!supabase || updates.length === 0) return;
    const db = supabase; // TypeScript narrowing
    await Promise.all(
      updates.map(({ id, data }) =>
        db.from('sieges').update(data).eq('id', id)
      )
    );
  },

  async complete(id: string): Promise<void> {
    await this.update(id, { status: 'completed' });
  },

  async abandon(id: string): Promise<void> {
    await this.update(id, { status: 'abandoned' });
  },

  async breakSiege(id: string): Promise<void> {
    await this.update(id, { status: 'broken' });
  },
};

/**
 * Notification repository
 */
export const notificationRepo = {
  async getByDeity(deityId: string, limit = 50): Promise<DbNotification[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('deity_id', deityId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getUnreadByDeity(deityId: string): Promise<DbNotification[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('deity_id', deityId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByFaction(factionId: string, limit = 50): Promise<DbNotification[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('faction_id', factionId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(notification: DbNotificationInsert): Promise<DbNotification> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchCreate(notifications: DbNotificationInsert[]): Promise<DbNotification[]> {
    if (!supabase || notifications.length === 0) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();
    if (error) throw error;
    return data || [];
  },

  async markAsRead(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllAsRead(deityId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('deity_id', deityId)
      .eq('read', false);
    if (error) throw error;
  },

  async getUnreadCount(deityId: string): Promise<number> {
    if (!supabase) return 0;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('deity_id', deityId)
      .eq('read', false);
    if (error) throw error;
    return count || 0;
  },
};

/**
 * Relations repository
 */
export const relationRepo = {
  async getByShard(shardId: string): Promise<DbRelation[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('relations')
      .select('*')
      .eq('shard_id', shardId);
    if (error) throw error;
    return data || [];
  },

  async getByFactions(shardId: string, factionA: string, factionB: string): Promise<DbRelation | null> {
    if (!supabase) return null;
    // Ensure consistent ordering (faction_a < faction_b)
    const [a, b] = factionA < factionB ? [factionA, factionB] : [factionB, factionA];
    const { data, error } = await supabase
      .from('relations')
      .select('*')
      .eq('shard_id', shardId)
      .eq('faction_a', a)
      .eq('faction_b', b)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getForFaction(shardId: string, factionId: string): Promise<DbRelation[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('relations')
      .select('*')
      .eq('shard_id', shardId)
      .or(`faction_a.eq.${factionId},faction_b.eq.${factionId}`);
    if (error) throw error;
    return data || [];
  },

  async create(relation: DbRelationInsert): Promise<DbRelation> {
    if (!supabase) throw new Error('Supabase not configured');
    // Ensure consistent ordering
    const [a, b] = relation.faction_a < relation.faction_b
      ? [relation.faction_a, relation.faction_b]
      : [relation.faction_b, relation.faction_a];
    const { data, error } = await supabase
      .from('relations')
      .insert({ ...relation, faction_a: a, faction_b: b })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbRelationUpdate): Promise<DbRelation> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('relations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async upsertByFactions(
    shardId: string,
    factionA: string,
    factionB: string,
    updates: DbRelationUpdate
  ): Promise<DbRelation> {
    if (!supabase) throw new Error('Supabase not configured');
    // Ensure consistent ordering
    const [a, b] = factionA < factionB ? [factionA, factionB] : [factionB, factionA];

    // Check if relation exists
    const existing = await this.getByFactions(shardId, a, b);
    if (existing) {
      return this.update(existing.id, updates);
    }

    // Create new relation
    return this.create({
      shard_id: shardId,
      faction_a: a,
      faction_b: b,
      status: updates.status || 'neutral',
      since_tick: updates.since_tick || 0,
      proposed_by: updates.proposed_by || null,
      proposal_type: updates.proposal_type || null,
    });
  },
};

/**
 * Messages repository
 */
export const messageRepo = {
  async getByShard(shardId: string, limit = 100): Promise<DbMessage[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('shard_id', shardId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getByReceiver(receiverId: string, limit = 50): Promise<DbMessage[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', receiverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getUnreadByReceiver(receiverId: string): Promise<DbMessage[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', receiverId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getConversation(factionA: string, factionB: string, limit = 50): Promise<DbMessage[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${factionA},receiver_id.eq.${factionB}),and(sender_id.eq.${factionB},receiver_id.eq.${factionA})`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(message: DbMessageInsert): Promise<DbMessage> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAsRead(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllAsRead(receiverId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', receiverId)
      .eq('read', false);
    if (error) throw error;
  },

  async getUnreadCount(receiverId: string): Promise<number> {
    if (!supabase) return 0;
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', receiverId)
      .eq('read', false);
    if (error) throw error;
    return count || 0;
  },
};

/**
 * Diplomatic events repository
 */
export const diplomaticEventRepo = {
  async getByShard(shardId: string, limit = 100): Promise<DbDiplomaticEvent[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('diplomatic_events')
      .select('*')
      .eq('shard_id', shardId)
      .order('tick', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getByFaction(shardId: string, factionId: string, limit = 50): Promise<DbDiplomaticEvent[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('diplomatic_events')
      .select('*')
      .eq('shard_id', shardId)
      .or(`initiator_id.eq.${factionId},target_id.eq.${factionId}`)
      .order('tick', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(event: DbDiplomaticEventInsert): Promise<DbDiplomaticEvent> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('diplomatic_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

/**
 * Season repository
 */
export const seasonRepo = {
  async getById(id: string): Promise<DbSeason | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getByShard(shardId: string): Promise<DbSeason[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('shard_id', shardId)
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getActive(shardId: string): Promise<DbSeason | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('shard_id', shardId)
      .eq('status', 'active')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(season: DbSeasonInsert): Promise<DbSeason> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('seasons')
      .insert(season)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbSeasonUpdate): Promise<DbSeason> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('seasons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

/**
 * Legacy repository
 */
export const legacyRepo = {
  async getByDeity(deityId: string): Promise<DbLegacy[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('legacy')
      .select('*')
      .eq('deity_id', deityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getBySeason(seasonId: string): Promise<DbLegacy[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('legacy')
      .select('*')
      .eq('season_id', seasonId)
      .order('rank', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getTopRanks(limit = 10): Promise<DbLegacy[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('legacy')
      .select('*')
      .eq('rank', 1)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(legacy: DbLegacyInsert): Promise<DbLegacy> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('legacy')
      .insert(legacy)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchCreate(legacies: DbLegacyInsert[]): Promise<DbLegacy[]> {
    if (!supabase || legacies.length === 0) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('legacy')
      .insert(legacies)
      .select();
    if (error) throw error;
    return data || [];
  },
};

/**
 * Season archive repository
 */
export const seasonArchiveRepo = {
  async getBySeason(seasonId: string): Promise<DbSeasonArchive[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('season_archives')
      .select('*')
      .eq('season_id', seasonId);
    if (error) throw error;
    return data || [];
  },

  async getByType(seasonId: string, archiveType: DbSeasonArchive['archive_type']): Promise<DbSeasonArchive | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('season_archives')
      .select('*')
      .eq('season_id', seasonId)
      .eq('archive_type', archiveType)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(archive: DbSeasonArchiveInsert): Promise<DbSeasonArchive> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('season_archives')
      .insert(archive)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

/**
 * Dominance tracking repository
 */
export const dominanceTrackingRepo = {
  async getActive(seasonId: string): Promise<DbDominanceTracking[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('dominance_tracking')
      .select('*')
      .eq('season_id', seasonId)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  async getByFaction(seasonId: string, factionId: string): Promise<DbDominanceTracking | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('dominance_tracking')
      .select('*')
      .eq('season_id', seasonId)
      .eq('faction_id', factionId)
      .eq('is_active', true)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(tracking: DbDominanceTrackingInsert): Promise<DbDominanceTracking> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('dominance_tracking')
      .insert(tracking)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbDominanceTrackingUpdate): Promise<DbDominanceTracking> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('dominance_tracking')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deactivate(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('dominance_tracking')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  async deactivateAll(seasonId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('dominance_tracking')
      .update({ is_active: false })
      .eq('season_id', seasonId)
      .eq('is_active', true);
    if (error) throw error;
  },
};

/**
 * Myth repository
 */
export const mythRepo = {
  async getByFaction(factionId: string, limit = 50): Promise<DbMyth[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('myths')
      .select('*')
      .eq('faction_id', factionId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getByShard(shardId: string, limit = 100): Promise<DbMyth[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('myths')
      .select('*')
      .eq('shard_id', shardId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getNotable(shardId: string, limit = 20): Promise<DbMyth[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('myths')
      .select('*')
      .eq('shard_id', shardId)
      .eq('is_notable', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<DbMyth | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('myths')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(myth: DbMythInsert): Promise<DbMyth> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('myths')
      .insert(myth)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbMythUpdate): Promise<DbMyth> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('myths')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async incrementViews(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.rpc('increment_myth_views', { myth_id: id });
    // Fall back to manual increment if RPC doesn't exist
    if (error) {
      const myth = await this.getById(id);
      if (myth) {
        await this.update(id, { views: myth.views + 1 });
      }
    }
  },

  async incrementShares(id: string): Promise<void> {
    if (!supabase) return;
    const myth = await this.getById(id);
    if (myth) {
      await this.update(id, { shares: myth.shares + 1 });
    }
  },
};

/**
 * Myth template repository
 */
export const mythTemplateRepo = {
  async getByEventType(eventType: string): Promise<DbMythTemplate[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('myth_templates')
      .select('*')
      .eq('event_type', eventType);
    if (error) throw error;
    return data || [];
  },

  async getAll(): Promise<DbMythTemplate[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('myth_templates')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async create(template: DbMythTemplateInsert): Promise<DbMythTemplate> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('myth_templates')
      .insert(template)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

/**
 * Champion repository
 */
export const championRepo = {
  async getById(id: string): Promise<DbChampion | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('champions')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getByFaction(factionId: string, aliveOnly = true): Promise<DbChampion[]> {
    if (!supabase) return [];
    let query = supabase
      .from('champions')
      .select('*')
      .eq('faction_id', factionId);
    if (aliveOnly) {
      query = query.eq('is_alive', true);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByShard(shardId: string, aliveOnly = true): Promise<DbChampion[]> {
    if (!supabase) return [];
    let query = supabase
      .from('champions')
      .select('*')
      .eq('shard_id', shardId);
    if (aliveOnly) {
      query = query.eq('is_alive', true);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByTerritory(territoryId: string): Promise<DbChampion[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('champions')
      .select('*')
      .eq('territory_id', territoryId)
      .eq('is_alive', true);
    if (error) throw error;
    return data || [];
  },

  async getAliveCount(factionId: string): Promise<number> {
    if (!supabase) return 0;
    const { count, error } = await supabase
      .from('champions')
      .select('*', { count: 'exact', head: true })
      .eq('faction_id', factionId)
      .eq('is_alive', true);
    if (error) throw error;
    return count || 0;
  },

  async create(champion: DbChampionInsert): Promise<DbChampion> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('champions')
      .insert(champion)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbChampionUpdate): Promise<DbChampion> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('champions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async batchUpdate(updates: Array<{ id: string; data: DbChampionUpdate }>): Promise<void> {
    if (!supabase || updates.length === 0) return;
    const db = supabase;
    await Promise.all(
      updates.map(({ id, data }) =>
        db.from('champions').update(data).eq('id', id)
      )
    );
  },

  async kill(id: string, tick: number, cause: string): Promise<DbChampion> {
    return this.update(id, {
      is_alive: false,
      death_tick: tick,
      death_cause: cause as DbChampion['death_cause'],
    });
  },

  async bless(id: string, tick: number): Promise<DbChampion> {
    const champion = await this.getById(id);
    if (!champion) throw new Error('Champion not found');

    // Calculate blessed stats (+50%)
    const newStats = {
      combat: Math.round(champion.stats.combat * 1.5),
      leadership: Math.round(champion.stats.leadership * 1.5),
      loyalty: Math.min(100, champion.stats.loyalty + 20),
    };

    // Calculate blessed lifespan (+50%)
    const newMaxLifespan = Math.round(champion.max_lifespan * 1.5);

    return this.update(id, {
      blessed: true,
      blessed_at: tick,
      stats: newStats,
      max_lifespan: newMaxLifespan,
    });
  },

  async assignToArmy(id: string, armyId: string | null): Promise<DbChampion> {
    return this.update(id, { assigned_army_id: armyId });
  },

  async incrementKills(id: string, kills: number): Promise<void> {
    const champion = await this.getById(id);
    if (champion) {
      await this.update(id, { kills: champion.kills + kills });
    }
  },

  async recordBattle(id: string, won: boolean): Promise<void> {
    const champion = await this.getById(id);
    if (champion) {
      const updates: DbChampionUpdate = {
        battles_fought: champion.battles_fought + 1,
      };
      if (won) {
        updates.battles_won = champion.battles_won + 1;
      }
      await this.update(id, updates);
    }
  },
};

/**
 * Champion names repository
 */
export const championNameRepo = {
  async getByType(nameType: 'first' | 'title' | 'epithet'): Promise<DbChampionName[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('champion_names')
      .select('*')
      .eq('name_type', nameType);
    if (error) throw error;
    return data || [];
  },

  async getByCulture(culture: string): Promise<DbChampionName[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('champion_names')
      .select('*')
      .eq('culture', culture);
    if (error) throw error;
    return data || [];
  },

  async getAll(): Promise<DbChampionName[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('champion_names')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async getRandomByType(nameType: 'first' | 'title' | 'epithet'): Promise<DbChampionName | null> {
    if (!supabase) return null;
    // Weighted random selection - fetch all and select
    const names = await this.getByType(nameType);
    if (names.length === 0) return null;

    const totalWeight = names.reduce((sum, n) => sum + n.weight, 0);
    let random = Math.random() * totalWeight;

    for (const name of names) {
      random -= name.weight;
      if (random <= 0) {
        return name;
      }
    }
    return names[0];
  },
};
