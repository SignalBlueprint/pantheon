/**
 * WebSocket server for real-time game state synchronization
 */

import { WebSocket, WebSocketServer } from 'ws';
import {
  GameState,
  SerializedGameState,
  Territory,
  Faction,
  Siege,
  DiplomaticRelation,
  GameMessage,
  MessageType,
} from '@pantheon/shared';
import { castMiracle, MiracleCastResult } from '../systems/miracles.js';
import {
  declareWar,
  offerPeace,
  respondToPeace,
  proposeAlliance,
  respondToAlliance,
  breakAlliance,
  DiplomacyResult,
} from '../systems/diplomacy.js';
import { sendMessage, SendMessageResult } from '../systems/messages.js';
import { chooseSpecialization, ChooseSpecializationResult } from '../systems/specialization.js';

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

interface DeclareWarPayload {
  targetId: string;
}

interface OfferPeacePayload {
  targetId: string;
}

interface ProposeAlliancePayload {
  targetId: string;
}

interface BreakAlliancePayload {
  targetId: string;
}

interface RespondProposalPayload {
  proposerId: string;
  accept: boolean;
  proposalType: 'peace' | 'alliance';
}

interface SendMessagePayload {
  receiverId: string;
  content: string;
}

interface ChooseSpecializationPayload {
  specializationType: 'maritime' | 'fortress' | 'plains' | 'nomadic';
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
      case 'declare_war':
        this.handleDeclareWar(client, message.payload as DeclareWarPayload);
        break;
      case 'offer_peace':
        this.handleOfferPeace(client, message.payload as OfferPeacePayload);
        break;
      case 'propose_alliance':
        this.handleProposeAlliance(client, message.payload as ProposeAlliancePayload);
        break;
      case 'break_alliance':
        this.handleBreakAlliance(client, message.payload as BreakAlliancePayload);
        break;
      case 'respond_proposal':
        this.handleRespondProposal(client, message.payload as RespondProposalPayload);
        break;
      case 'send_message':
        this.handleSendMessage(client, message.payload as SendMessagePayload);
        break;
      case 'choose_specialization':
        this.handleChooseSpecialization(client, message.payload as ChooseSpecializationPayload);
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

  /**
   * Handle declare war request
   */
  private handleDeclareWar(client: Client, payload: DeclareWarPayload): void {
    if (!this.gameState || !client.factionId) {
      this.sendDiplomacyResult(client, { success: false, error: 'Not initialized' });
      return;
    }

    const result = declareWar(this.gameState, client.factionId, payload.targetId);
    this.sendDiplomacyResult(client, result);

    if (result.success) {
      this.broadcastDiplomaticEvent(result.eventType!, client.factionId, payload.targetId, result.relation);
    }
  }

  /**
   * Handle offer peace request
   */
  private handleOfferPeace(client: Client, payload: OfferPeacePayload): void {
    if (!this.gameState || !client.factionId) {
      this.sendDiplomacyResult(client, { success: false, error: 'Not initialized' });
      return;
    }

    const result = offerPeace(this.gameState, client.factionId, payload.targetId);
    this.sendDiplomacyResult(client, result);

    if (result.success) {
      this.broadcastDiplomaticEvent(result.eventType!, client.factionId, payload.targetId, result.relation);
    }
  }

  /**
   * Handle propose alliance request
   */
  private handleProposeAlliance(client: Client, payload: ProposeAlliancePayload): void {
    if (!this.gameState || !client.factionId) {
      this.sendDiplomacyResult(client, { success: false, error: 'Not initialized' });
      return;
    }

    const result = proposeAlliance(this.gameState, client.factionId, payload.targetId);
    this.sendDiplomacyResult(client, result);

    if (result.success) {
      this.broadcastDiplomaticEvent(result.eventType!, client.factionId, payload.targetId, result.relation);
    }
  }

  /**
   * Handle break alliance request
   */
  private handleBreakAlliance(client: Client, payload: BreakAlliancePayload): void {
    if (!this.gameState || !client.factionId) {
      this.sendDiplomacyResult(client, { success: false, error: 'Not initialized' });
      return;
    }

    const result = breakAlliance(this.gameState, client.factionId, payload.targetId);
    this.sendDiplomacyResult(client, result);

    if (result.success) {
      this.broadcastDiplomaticEvent(result.eventType!, client.factionId, payload.targetId, result.relation);
    }
  }

  /**
   * Handle respond to proposal request
   */
  private handleRespondProposal(client: Client, payload: RespondProposalPayload): void {
    if (!this.gameState || !client.factionId) {
      this.sendDiplomacyResult(client, { success: false, error: 'Not initialized' });
      return;
    }

    let result: DiplomacyResult;
    if (payload.proposalType === 'peace') {
      result = respondToPeace(this.gameState, client.factionId, payload.proposerId, payload.accept);
    } else {
      result = respondToAlliance(this.gameState, client.factionId, payload.proposerId, payload.accept);
    }

    this.sendDiplomacyResult(client, result);

    if (result.success && result.eventType) {
      this.broadcastDiplomaticEvent(result.eventType, client.factionId, payload.proposerId, result.relation);
    }
  }

  /**
   * Handle send message request
   */
  private async handleSendMessage(client: Client, payload: SendMessagePayload): Promise<void> {
    if (!this.gameState || !client.factionId) {
      this.sendToClient(client, {
        type: 'send_message',
        payload: { success: false, error: 'Not initialized' },
        timestamp: Date.now(),
      });
      return;
    }

    const shardId = this.gameState.shardId || 'default';
    const result = await sendMessage(
      shardId,
      client.factionId,
      payload.receiverId,
      payload.content
    );

    // Send result to sender
    this.sendToClient(client, {
      type: 'send_message',
      payload: result,
      timestamp: Date.now(),
    });

    // If successful, notify the receiver if they're connected
    if (result.success && result.message) {
      this.sendToFaction(payload.receiverId, {
        type: 'send_message',
        payload: { received: true, message: result.message },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle specialization choice request from client
   */
  private handleChooseSpecialization(client: Client, payload: ChooseSpecializationPayload): void {
    if (!this.gameState) {
      this.sendToClient(client, {
        type: 'specialization_chosen',
        payload: { success: false, error: 'Game state not initialized' },
        timestamp: Date.now(),
      });
      return;
    }

    if (!client.factionId) {
      this.sendToClient(client, {
        type: 'specialization_chosen',
        payload: { success: false, error: 'No faction selected' },
        timestamp: Date.now(),
      });
      return;
    }

    const faction = this.gameState.factions.get(client.factionId);
    if (!faction) {
      this.sendToClient(client, {
        type: 'specialization_chosen',
        payload: { success: false, error: 'Faction not found' },
        timestamp: Date.now(),
      });
      return;
    }

    const result = chooseSpecialization(faction, payload.specializationType);

    // Send result to the client
    this.sendToClient(client, {
      type: 'specialization_chosen',
      payload: result,
      timestamp: Date.now(),
    });

    // If successful, broadcast the choice to all clients
    if (result.success) {
      this.broadcast({
        type: 'specialization_chosen',
        payload: {
          factionId: faction.id,
          factionName: faction.name,
          specialization: result.specialization,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Send message to a specific faction (all clients connected as that faction)
   */
  private sendToFaction(factionId: string, message: GameMessage): void {
    for (const client of this.clients.values()) {
      if (client.factionId === factionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Send diplomacy result to client
   */
  private sendDiplomacyResult(client: Client, result: DiplomacyResult): void {
    this.sendToClient(client, {
      type: 'diplomatic_event',
      payload: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a diplomatic event to all clients
   */
  private broadcastDiplomaticEvent(
    eventType: string,
    initiatorId: string,
    targetId: string,
    relation?: DiplomaticRelation
  ): void {
    this.broadcast({
      type: 'diplomatic_event',
      payload: {
        eventType,
        initiatorId,
        targetId,
        relation,
      },
      timestamp: Date.now(),
    });
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

    const sieges: Record<string, Siege> = {};
    for (const [id, s] of state.sieges) {
      sieges[id] = s;
    }

    const relations: Record<string, DiplomaticRelation> = {};
    for (const [id, r] of state.relations) {
      relations[id] = r;
    }

    return {
      tick: state.tick,
      shardId: state.shardId,
      territories,
      factions,
      pendingBattles: state.pendingBattles,
      sieges,
      relations,
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
