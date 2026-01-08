'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SerializedGameState, Territory, Faction, Siege, GameMessage } from '@pantheon/shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface MiracleResult {
  success: boolean;
  error?: string;
  effectId?: string;
}

export interface MiracleCastEvent {
  factionId: string;
  miracleId: string;
  targetId: string;
  effectId?: string;
}

export interface SiegeEvent {
  siege: Siege;
  territoryId: string;
  attackerName?: string;
  defenderName?: string;
}

interface UseGameSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMiracleResult?: (result: MiracleResult) => void;
  onMiracleCast?: (event: MiracleCastEvent) => void;
  onSiegeStarted?: (event: SiegeEvent) => void;
  onSiegeProgress?: (event: SiegeEvent) => void;
  onSiegeComplete?: (event: SiegeEvent) => void;
  onSiegeBroken?: (event: SiegeEvent) => void;
}

interface UseGameSocketReturn {
  gameState: SerializedGameState | null;
  status: ConnectionStatus;
  clientId: string | null;
  factionId: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: GameMessage) => void;
  selectFaction: (factionId: string) => void;
  castMiracle: (miracleId: string, targetId: string) => void;
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
    onMiracleResult,
    onMiracleCast,
    onSiegeStarted,
    onSiegeProgress,
    onSiegeComplete,
    onSiegeBroken,
  } = options;

  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const [factionId, setFactionId] = useState<string | null>(null);

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

        case 'miracle_result':
          onMiracleResult?.(message.payload as MiracleResult);
          break;

        case 'miracle_cast':
          onMiracleCast?.(message.payload as MiracleCastEvent);
          break;

        case 'siege_started':
          onSiegeStarted?.(message.payload as SiegeEvent);
          // Update local state with new siege
          setGameState((prev) => {
            if (!prev) return null;
            const siegeEvent = message.payload as SiegeEvent;
            return {
              ...prev,
              sieges: {
                ...prev.sieges,
                [siegeEvent.siege.id]: siegeEvent.siege,
              },
            };
          });
          break;

        case 'siege_progress':
          onSiegeProgress?.(message.payload as SiegeEvent);
          // Update siege progress in local state
          setGameState((prev) => {
            if (!prev) return null;
            const siegeEvent = message.payload as SiegeEvent;
            return {
              ...prev,
              sieges: {
                ...prev.sieges,
                [siegeEvent.siege.id]: siegeEvent.siege,
              },
            };
          });
          break;

        case 'siege_complete':
          onSiegeComplete?.(message.payload as SiegeEvent);
          // Remove completed siege from local state
          setGameState((prev) => {
            if (!prev) return null;
            const siegeEvent = message.payload as SiegeEvent;
            const { [siegeEvent.siege.id]: _removed, ...remainingSieges } = prev.sieges;
            return {
              ...prev,
              sieges: remainingSieges,
            };
          });
          break;

        case 'siege_broken':
          onSiegeBroken?.(message.payload as SiegeEvent);
          // Remove broken siege from local state
          setGameState((prev) => {
            if (!prev) return null;
            const siegeEvent = message.payload as SiegeEvent;
            const { [siegeEvent.siege.id]: _removed, ...remainingSieges } = prev.sieges;
            return {
              ...prev,
              sieges: remainingSieges,
            };
          });
          break;

        default:
          console.log('[Socket] Unhandled message type:', message.type);
      }
    } catch (e) {
      console.error('[Socket] Failed to parse message:', e);
    }
  }, [onMiracleResult, onMiracleCast, onSiegeStarted, onSiegeProgress, onSiegeComplete, onSiegeBroken]);

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

  const selectFaction = useCallback((selectedFactionId: string) => {
    setFactionId(selectedFactionId);
    sendMessage({
      type: 'select_faction',
      payload: { factionId: selectedFactionId },
      timestamp: Date.now(),
    });
    console.log('[Socket] Selected faction:', selectedFactionId);
  }, [sendMessage]);

  const castMiracle = useCallback((miracleId: string, targetId: string) => {
    sendMessage({
      type: 'cast_miracle',
      payload: { miracleId, targetId },
      timestamp: Date.now(),
    });
    console.log('[Socket] Casting miracle:', miracleId, 'on target:', targetId);
  }, [sendMessage]);

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
    factionId,
    connect,
    disconnect,
    sendMessage,
    selectFaction,
    castMiracle,
  };
}

export default useGameSocket;
