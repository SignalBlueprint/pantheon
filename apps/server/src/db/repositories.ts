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
