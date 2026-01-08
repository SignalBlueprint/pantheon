'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SerializedGameState, Territory, GameMessage } from '@pantheon/shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseGameSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseGameSocketReturn {
  gameState: SerializedGameState | null;
  status: ConnectionStatus;
  clientId: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: GameMessage) => void;
}

const DEFAULT_URL = 'ws://localhost:3001';
const DEFAULT_RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * React hook for WebSocket game state synchronization
 */
export function useGameSocket(options: UseGameSocketOptions = {}): UseGameSocketReturn {
  const {
    url = DEFAULT_URL,
    autoConnect = true,
    reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
    maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS,
  } = options;

  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: GameMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'connect':
          setClientId((message.payload as { clientId: string }).clientId);
          break;

        case 'world_state':
          const payload = message.payload as SerializedGameState | { tick: number };
          if ('territories' in payload) {
            // Full state update
            setGameState(payload);
          } else {
            // Tick-only update
            setGameState((prev) => (prev ? { ...prev, tick: payload.tick } : null));
          }
          break;

        case 'territory_update':
          const territory = message.payload as Territory;
          setGameState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              territories: {
                ...prev.territories,
                [territory.id]: territory,
              },
            };
          });
          break;

        default:
          console.log('[Socket] Unhandled message type:', message.type);
      }
    } catch (e) {
      console.error('[Socket] Failed to parse message:', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    clearReconnectTimeout();

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        console.log('[Socket] Connected to server');
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setStatus('reconnecting');
          console.log(
            `[Socket] Reconnecting... attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`
          );
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        } else {
          console.log('[Socket] Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('[Socket] Error:', error);
      };
    } catch (e) {
      console.error('[Socket] Failed to connect:', e);
      setStatus('disconnected');
    }
  }, [url, handleMessage, clearReconnectTimeout, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  const sendMessage = useCallback((message: GameMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[Socket] Cannot send message - not connected');
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    gameState,
    status,
    clientId,
    connect,
    disconnect,
    sendMessage,
  };
}

export default useGameSocket;
