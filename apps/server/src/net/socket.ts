/**
 * WebSocket server for real-time game state synchronization
 */

import { WebSocket, WebSocketServer } from 'ws';
import {
  GameState,
  SerializedGameState,
  Territory,
  Faction,
  GameMessage,
  MessageType,
} from '@pantheon/shared';
import { castMiracle, MiracleCastResult } from '../systems/miracles.js';

interface Client {
  ws: WebSocket;
  id: string;
  factionId?: string; // Associated faction for this client
  connectedAt: number;
}

interface CastMiraclePayload {
  miracleId: string;
  targetId: string;
}

interface SelectFactionPayload {
  factionId: string;
}

/**
 * Game Socket Server - manages WebSocket connections and state broadcasting
 */
export class GameSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private clientIdCounter = 0;
  private previousState: SerializedGameState | null = null;
  private gameState: GameState | null = null;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupHandlers();
  }

  /**
   * Set the game state reference for miracle casting
   */
  setGameState(state: GameState): void {
    this.gameState = state;
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws) => {
      const clientId = `client_${++this.clientIdCounter}`;
      const client: Client = {
        ws,
        id: clientId,
        connectedAt: Date.now(),
      };

      this.clients.set(clientId, client);
      console.log(`[Socket] Client connected: ${clientId} (${this.clients.size} total)`);

      // Send connection confirmation
      this.sendToClient(client, {
        type: 'connect',
        payload: { clientId },
        timestamp: Date.now(),
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as GameMessage;
          this.handleMessage(client, message);
        } catch (e) {
          console.error(`[Socket] Failed to parse message from ${clientId}:`, e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`[Socket] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
      });

      ws.on('error', (error) => {
        console.error(`[Socket] Error from ${clientId}:`, error);
      });
    });
  }

  private handleMessage(client: Client, message: GameMessage): void {
    console.log(`[Socket] Message from ${client.id}:`, message.type);

    // Handle different message types here
    switch (message.type) {
      case 'policy_change':
        // Handle policy change requests
        break;
      case 'miracle':
        // Handle miracle requests (legacy)
        break;
      case 'cast_miracle':
        this.handleCastMiracle(client, message.payload as CastMiraclePayload);
        break;
      case 'select_faction':
        // Associate client with a faction
        const selectPayload = message.payload as SelectFactionPayload;
        client.factionId = selectPayload.factionId;
        console.log(`[Socket] Client ${client.id} selected faction: ${client.factionId}`);
        break;
      default:
        console.log(`[Socket] Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Handle miracle cast request from client
   */
  private handleCastMiracle(client: Client, payload: CastMiraclePayload): void {
    if (!this.gameState) {
      this.sendToClient(client, {
        type: 'miracle_result',
        payload: { success: false, error: 'Game state not initialized' },
        timestamp: Date.now(),
      });
      return;
    }

    if (!client.factionId) {
      this.sendToClient(client, {
        type: 'miracle_result',
        payload: { success: false, error: 'No faction selected' },
        timestamp: Date.now(),
      });
      return;
    }

    const { miracleId, targetId } = payload;

    // Cast the miracle using the miracle system
    const result: MiracleCastResult = castMiracle(
      this.gameState,
      client.factionId,
      miracleId,
      targetId
    );

    // Send result to the casting client
    this.sendToClient(client, {
      type: 'miracle_result',
      payload: result,
      timestamp: Date.now(),
    });

    // If successful, broadcast the miracle event to all clients
    if (result.success) {
      this.broadcast({
        type: 'miracle_cast',
        payload: {
          factionId: client.factionId,
          miracleId,
          targetId,
          effectId: result.effectId,
        },
        timestamp: Date.now(),
      });
    }
  }

  private sendToClient(client: Client, message: GameMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast full game state to all clients
   */
  broadcastState(state: GameState): void {
    const serialized = this.serializeState(state);

    const message: GameMessage = {
      type: 'world_state',
      payload: serialized,
      timestamp: Date.now(),
    };

    this.broadcast(message);
    this.previousState = serialized;
  }

  /**
   * Broadcast state diff (only changed territories and factions)
   */
  broadcastStateDiff(state: GameState): void {
    const serialized = this.serializeState(state);

    if (!this.previousState) {
      // No previous state - send full state
      this.broadcastState(state);
      return;
    }

    // Calculate diff
    const diff = this.calculateDiff(this.previousState, serialized);

    if (diff.territories.length === 0 && diff.factions.length === 0) {
      // No changes - just send tick update
      const message: GameMessage = {
        type: 'world_state',
        payload: { tick: serialized.tick },
        timestamp: Date.now(),
      };
      this.broadcast(message);
    } else {
      // Send territory updates
      for (const territory of diff.territories) {
        const message: GameMessage = {
          type: 'territory_update',
          payload: territory,
          timestamp: Date.now(),
        };
        this.broadcast(message);
      }
    }

    this.previousState = serialized;
  }

  /**
   * Calculate diff between two states
   */
  private calculateDiff(
    prev: SerializedGameState,
    curr: SerializedGameState
  ): { territories: Territory[]; factions: Faction[] } {
    const changedTerritories: Territory[] = [];
    const changedFactions: Faction[] = [];

    // Check territories
    for (const [id, territory] of Object.entries(curr.territories)) {
      const prevTerritory = prev.territories[id];
      if (!prevTerritory || this.territoryChanged(prevTerritory, territory)) {
        changedTerritories.push(territory);
      }
    }

    // Check factions
    for (const [id, faction] of Object.entries(curr.factions)) {
      const prevFaction = prev.factions[id];
      if (!prevFaction || this.factionChanged(prevFaction, faction)) {
        changedFactions.push(faction);
      }
    }

    return { territories: changedTerritories, factions: changedFactions };
  }

  private territoryChanged(prev: Territory, curr: Territory): boolean {
    return (
      prev.owner !== curr.owner ||
      prev.population !== curr.population ||
      prev.food !== curr.food ||
      prev.production !== curr.production ||
      prev.activeEffects.length !== curr.activeEffects.length
    );
  }

  private factionChanged(prev: Faction, curr: Faction): boolean {
    return (
      prev.territories.length !== curr.territories.length ||
      prev.resources.food !== curr.resources.food ||
      prev.resources.production !== curr.resources.production ||
      prev.divinePower !== curr.divinePower
    );
  }

  /**
   * Serialize GameState for JSON transport
   */
  private serializeState(state: GameState): SerializedGameState {
    const territories: Record<string, Territory> = {};
    for (const [id, t] of state.territories) {
      territories[id] = t;
    }

    const factions: Record<string, Faction> = {};
    for (const [id, f] of state.factions) {
      factions[id] = f;
    }

    return {
      tick: state.tick,
      territories,
      factions,
      pendingBattles: state.pendingBattles,
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: GameMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
