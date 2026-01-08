'use client';

import { useState, useEffect, useCallback } from 'react';
import { Faction, DiplomaticMessage } from '@pantheon/shared';

interface MessagesPanelProps {
  playerFactionId: string;
  factions: Record<string, Faction>;
  onSendMessage: (receiverId: string, content: string) => void;
}

interface ConversationMessages {
  [factionId: string]: DiplomaticMessage[];
}

/**
 * Format relative time for message timestamps
 */
function formatTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MessagesPanel({
  playerFactionId,
  factions,
  onSendMessage,
}: MessagesPanelProps) {
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [conversations, setConversations] = useState<ConversationMessages>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const otherFactions = Object.values(factions).filter(f => f.id !== playerFactionId);

  // Fetch messages for selected faction
  const fetchConversation = useCallback(async (otherFactionId: string) => {
    try {
      const response = await fetch(
        `/api/messages/conversation?factionA=${playerFactionId}&factionB=${otherFactionId}`
      );
      if (response.ok) {
        const data = await response.json();
        setConversations(prev => ({
          ...prev,
          [otherFactionId]: data.messages || [],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  }, [playerFactionId]);

  // Fetch unread counts on mount
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const response = await fetch(`/api/messages/unread-count?factionId=${playerFactionId}`);
        if (response.ok) {
          const data = await response.json();
          // For now, we show total unread - could break down by sender later
          setUnreadCounts({ total: data.count });
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
    fetchUnread();
  }, [playerFactionId]);

  // Load conversation when selecting a faction
  useEffect(() => {
    if (selectedFaction) {
      fetchConversation(selectedFaction);
    }
  }, [selectedFaction, fetchConversation]);

  const handleSend = () => {
    if (!selectedFaction || !messageInput.trim()) return;

    onSendMessage(selectedFaction, messageInput.trim());

    // Optimistically add to local state
    const newMessage: DiplomaticMessage = {
      id: `temp_${Date.now()}`,
      senderId: playerFactionId,
      receiverId: selectedFaction,
      messageType: 'text',
      content: messageInput.trim(),
      read: true,
      createdAt: Date.now(),
    };

    setConversations(prev => ({
      ...prev,
      [selectedFaction]: [newMessage, ...(prev[selectedFaction] || [])],
    }));

    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>💬</span> Messages
          {unreadCounts.total > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCounts.total}
            </span>
          )}
        </h3>
      </div>

      <div className="flex h-80">
        {/* Faction list */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {otherFactions.map((faction) => (
            <button
              key={faction.id}
              onClick={() => setSelectedFaction(faction.id)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                selectedFaction === faction.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: faction.color }}
              />
              <span className="text-sm text-gray-900 dark:text-white truncate">
                {faction.name}
              </span>
            </button>
          ))}
          {otherFactions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No other factions
            </div>
          )}
        </div>

        {/* Conversation area */}
        <div className="flex-1 flex flex-col">
          {selectedFaction ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col-reverse">
                {(conversations[selectedFaction] || []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] ${
                      msg.senderId === playerFactionId
                        ? 'ml-auto bg-blue-600 text-white'
                        : 'mr-auto bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    } rounded-lg px-3 py-2`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.senderId === playerFactionId
                        ? 'text-blue-200'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                ))}
                {(!conversations[selectedFaction] || conversations[selectedFaction].length === 0) && (
                  <div className="text-center text-gray-500 text-sm py-4">
                    No messages yet. Start the conversation!
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a faction to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagesPanel;
