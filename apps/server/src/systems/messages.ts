/**
 * Deity-to-deity message system
 * Allows factions to send text messages to each other
 */

import {
  DiplomaticMessage,
  DiplomaticMessageType,
} from '@pantheon/shared';
import { messageRepo } from '../db/repositories.js';
import { DbMessageInsert } from '../db/types.js';

export interface SendMessageResult {
  success: boolean;
  error?: string;
  message?: DiplomaticMessage;
}

/**
 * Send a message from one faction to another
 */
export async function sendMessage(
  shardId: string,
  senderId: string,
  receiverId: string,
  content: string,
  messageType: DiplomaticMessageType = 'text',
  data?: Record<string, unknown>
): Promise<SendMessageResult> {
  // Validate
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Message content cannot be empty' };
  }

  if (content.length > 500) {
    return { success: false, error: 'Message content cannot exceed 500 characters' };
  }

  if (senderId === receiverId) {
    return { success: false, error: 'Cannot send message to yourself' };
  }

  try {
    const dbMessage: DbMessageInsert = {
      shard_id: shardId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_type: messageType,
      content: content.trim(),
      data: data || {},
      read: false,
    };

    const created = await messageRepo.create(dbMessage);

    const message: DiplomaticMessage = {
      id: created.id,
      senderId: created.sender_id,
      receiverId: created.receiver_id,
      messageType: created.message_type as DiplomaticMessageType,
      content: created.content,
      data: created.data as Record<string, unknown>,
      read: created.read,
      createdAt: new Date(created.created_at).getTime(),
    };

    console.log(`[Messages] ${senderId} -> ${receiverId}: ${content.substring(0, 50)}...`);
    return { success: true, message };
  } catch (error) {
    console.error('[Messages] Failed to send message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Get messages for a faction
 */
export async function getMessages(
  factionId: string,
  limit = 50
): Promise<DiplomaticMessage[]> {
  try {
    const dbMessages = await messageRepo.getByReceiver(factionId, limit);
    return dbMessages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      messageType: m.message_type as DiplomaticMessageType,
      content: m.content,
      data: m.data as Record<string, unknown>,
      read: m.read,
      createdAt: new Date(m.created_at).getTime(),
    }));
  } catch (error) {
    console.error('[Messages] Failed to get messages:', error);
    return [];
  }
}

/**
 * Get conversation between two factions
 */
export async function getConversation(
  factionA: string,
  factionB: string,
  limit = 50
): Promise<DiplomaticMessage[]> {
  try {
    const dbMessages = await messageRepo.getConversation(factionA, factionB, limit);
    return dbMessages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      messageType: m.message_type as DiplomaticMessageType,
      content: m.content,
      data: m.data as Record<string, unknown>,
      read: m.read,
      createdAt: new Date(m.created_at).getTime(),
    }));
  } catch (error) {
    console.error('[Messages] Failed to get conversation:', error);
    return [];
  }
}

/**
 * Get unread message count for a faction
 */
export async function getUnreadMessageCount(factionId: string): Promise<number> {
  try {
    return await messageRepo.getUnreadCount(factionId);
  } catch (error) {
    console.error('[Messages] Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    await messageRepo.markAsRead(messageId);
  } catch (error) {
    console.error('[Messages] Failed to mark message as read:', error);
  }
}

/**
 * Mark all messages as read for a faction
 */
export async function markAllMessagesAsRead(factionId: string): Promise<void> {
  try {
    await messageRepo.markAllAsRead(factionId);
  } catch (error) {
    console.error('[Messages] Failed to mark all messages as read:', error);
  }
}
