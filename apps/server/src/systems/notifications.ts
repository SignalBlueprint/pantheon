/**
 * Notification System for Pantheon
 * Generates and manages in-game notifications
 */

import {
  GameState,
  Siege,
  Notification,
  NotificationType,
} from '@pantheon/shared';
import { notificationRepo } from '../db/repositories.js';
import { DbNotificationInsert } from '../db/types.js';
import { isSupabaseConfigured } from '../db/supabase.js';
import { SiegeEvent } from '../simulation/siege.js';

/**
 * Create a notification for a siege event
 */
export function createSiegeNotification(
  event: SiegeEvent,
  state: GameState
): Notification | null {
  const territory = state.territories.get(event.territoryId);
  const attacker = state.factions.get(event.attackerFactionId);
  const defender = event.defenderFactionId
    ? state.factions.get(event.defenderFactionId)
    : null;

  if (!territory || !attacker) return null;

  let type: NotificationType;
  let message: string;

  switch (event.type) {
    case 'started':
      type = 'siege_started';
      message = defender
        ? `${attacker.name} has begun a siege on your territory at (${territory.q}, ${territory.r})!`
        : `${attacker.name} is claiming territory at (${territory.q}, ${territory.r}).`;
      break;

    case 'progress_50':
      type = 'siege_50';
      message = `The siege on territory (${territory.q}, ${territory.r}) is halfway complete. Defend now or lose it!`;
      break;

    case 'progress_90':
      type = 'siege_90';
      message = `URGENT: The siege on territory (${territory.q}, ${territory.r}) is nearly complete! Final chance to defend!`;
      break;

    case 'completed':
      type = 'siege_complete';
      message = defender
        ? `${attacker.name} has captured your territory at (${territory.q}, ${territory.r}).`
        : `${attacker.name} has claimed territory at (${territory.q}, ${territory.r}).`;
      break;

    case 'broken':
      type = 'territory_gained';
      message = `Your forces successfully broke the siege on territory (${territory.q}, ${territory.r})!`;
      break;

    default:
      return null;
  }

  const notification: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    factionId: event.defenderFactionId,
    type,
    message,
    data: {
      siegeId: event.siege.id,
      territoryId: event.territoryId,
      attackerFactionId: event.attackerFactionId,
      defenderFactionId: event.defenderFactionId,
      progress: event.siege.progress,
      requiredProgress: event.siege.requiredProgress,
    },
    read: false,
    createdAt: state.tick,
  };

  return notification;
}

/**
 * Save notification to database
 */
export async function saveNotification(
  notification: Notification,
  shardId: string,
  deityId: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const dbNotification: DbNotificationInsert = {
    shard_id: shardId,
    deity_id: deityId,
    faction_id: notification.factionId,
    type: notification.type,
    message: notification.message,
    data: notification.data,
    read: notification.read,
  };

  try {
    await notificationRepo.create(dbNotification);
  } catch (error) {
    console.error('[Notifications] Failed to save notification:', error);
  }
}

/**
 * Handle siege events and generate notifications
 */
export function handleSiegeEvent(
  event: SiegeEvent,
  state: GameState,
  shardId?: string
): void {
  // Don't generate notifications for AI actions on AI territories
  const defender = event.defenderFactionId
    ? state.factions.get(event.defenderFactionId)
    : null;

  // Create notification
  const notification = createSiegeNotification(event, state);
  if (!notification) return;

  // Log to console
  console.log(`[Notifications] ${notification.type}: ${notification.message}`);

  // Save to database if defender is a player (has deity)
  if (shardId && defender?.deityId && defender.deityId !== 'ai') {
    saveNotification(notification, shardId, defender.deityId);
  }
}

/**
 * Create notification for territory lost
 */
export function createTerritoryLostNotification(
  state: GameState,
  factionId: string,
  territoryId: string,
  capturerFactionId: string
): Notification | null {
  const territory = state.territories.get(territoryId);
  const faction = state.factions.get(factionId);
  const capturer = state.factions.get(capturerFactionId);

  if (!territory || !faction || !capturer) return null;

  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    factionId,
    type: 'territory_lost',
    message: `You lost territory at (${territory.q}, ${territory.r}) to ${capturer.name}.`,
    data: {
      territoryId,
      capturerFactionId,
      q: territory.q,
      r: territory.r,
    },
    read: false,
    createdAt: state.tick,
  };
}

/**
 * Create notification for territory gained
 */
export function createTerritoryGainedNotification(
  state: GameState,
  factionId: string,
  territoryId: string,
  previousOwnerId: string | null
): Notification | null {
  const territory = state.territories.get(territoryId);
  const faction = state.factions.get(factionId);
  const previousOwner = previousOwnerId
    ? state.factions.get(previousOwnerId)
    : null;

  if (!territory || !faction) return null;

  const message = previousOwner
    ? `You captured territory at (${territory.q}, ${territory.r}) from ${previousOwner.name}!`
    : `You claimed new territory at (${territory.q}, ${territory.r}).`;

  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    factionId,
    type: 'territory_gained',
    message,
    data: {
      territoryId,
      previousOwnerId,
      q: territory.q,
      r: territory.r,
    },
    read: false,
    createdAt: state.tick,
  };
}

/**
 * Get unread notification count for a deity
 */
export async function getUnreadCount(deityId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  return notificationRepo.getUnreadCount(deityId);
}

/**
 * Get notifications for a deity
 */
export async function getNotifications(
  deityId: string,
  limit = 50
): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];

  const dbNotifications = await notificationRepo.getByDeity(deityId, limit);

  return dbNotifications.map((n) => ({
    id: n.id,
    factionId: n.faction_id,
    type: n.type,
    message: n.message,
    data: n.data as Record<string, unknown>,
    read: n.read,
    createdAt: Date.parse(n.created_at),
  }));
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await notificationRepo.markAsRead(notificationId);
}

/**
 * Mark all notifications as read for a deity
 */
export async function markAllAsRead(deityId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await notificationRepo.markAllAsRead(deityId);
}
