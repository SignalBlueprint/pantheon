import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { isSupabaseConfigured } from './db/supabase.js';
import { saveFullState, shouldSaveOnTick, saveGameState, loadGameState } from './db/persistence.js';
import { Ticker, createInitialGameState } from './simulation/ticker.js';
import { GameState } from '@pantheon/shared';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './systems/notifications.js';
import {
  getMessages,
  getConversation,
  getUnreadMessageCount,
  markMessageAsRead,
  markAllMessagesAsRead,
} from './systems/messages.js';
import {
  initializeSeason,
  getCurrentSeason,
  getTimeRemaining,
  calculateRankings,
  getPantheonHall,
  getDeityLegacy,
  processSeasonTick,
} from './systems/seasons.js';
import { processSpecializationTick } from './systems/specialization.js';
import {
  getFactionMyths,
  getShardMyths,
  getNotableMyths,
  recordMythView,
  recordMythShare,
} from './systems/myths.js';
import {
  processChampionSpawning,
  processChampionAging,
  getFactionChampions,
  getChampionById,
  blessChampion,
  assignChampionToArmy,
} from './systems/champions.js';
import { CHAMPION_BLESS_COST } from '@pantheon/shared';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Enable JSON parsing
app.use(express.json());

// Game state and ticker
let gameState: GameState = createInitialGameState();
let ticker: Ticker | null = null;
let isShuttingDown = false;

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    tick: gameState.tick,
    database: isSupabaseConfigured() ? 'connected' : 'not configured',
  });
});

// Notification API endpoints

// GET /api/notifications - Get notifications for a deity
app.get('/api/notifications', async (req, res) => {
  const deityId = req.query.deityId as string;
  if (!deityId) {
    return res.status(400).json({ error: 'deityId query parameter required' });
  }

  try {
    const notifications = await getNotifications(deityId);
    res.json({ notifications });
  } catch (error) {
    console.error('[API] Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
app.get('/api/notifications/unread-count', async (req, res) => {
  const deityId = req.query.deityId as string;
  if (!deityId) {
    return res.status(400).json({ error: 'deityId query parameter required' });
  }

  try {
    const count = await getUnreadCount(deityId);
    res.json({ count });
  } catch (error) {
    console.error('[API] Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// POST /api/notifications/:id/read - Mark a notification as read
app.post('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    await markAsRead(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// POST /api/notifications/mark-all-read - Mark all notifications as read for a deity
app.post('/api/notifications/mark-all-read', async (req, res) => {
  const deityId = req.body.deityId as string;
  if (!deityId) {
    return res.status(400).json({ error: 'deityId required in request body' });
  }

  try {
    await markAllAsRead(deityId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Message API endpoints

// GET /api/messages - Get messages for a faction
app.get('/api/messages', async (req, res) => {
  const factionId = req.query.factionId as string;
  if (!factionId) {
    return res.status(400).json({ error: 'factionId query parameter required' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  try {
    const messages = await getMessages(factionId, limit);
    res.json({ messages });
  } catch (error) {
    console.error('[API] Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/conversation - Get conversation between two factions
app.get('/api/messages/conversation', async (req, res) => {
  const factionA = req.query.factionA as string;
  const factionB = req.query.factionB as string;
  if (!factionA || !factionB) {
    return res.status(400).json({ error: 'factionA and factionB query parameters required' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  try {
    const messages = await getConversation(factionA, factionB, limit);
    res.json({ messages });
  } catch (error) {
    console.error('[API] Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// GET /api/messages/unread-count - Get unread message count
app.get('/api/messages/unread-count', async (req, res) => {
  const factionId = req.query.factionId as string;
  if (!factionId) {
    return res.status(400).json({ error: 'factionId query parameter required' });
  }

  try {
    const count = await getUnreadMessageCount(factionId);
    res.json({ count });
  } catch (error) {
    console.error('[API] Error fetching unread message count:', error);
    res.status(500).json({ error: 'Failed to fetch unread message count' });
  }
});

// POST /api/messages/:id/read - Mark a message as read
app.post('/api/messages/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    await markMessageAsRead(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// POST /api/messages/mark-all-read - Mark all messages as read for a faction
app.post('/api/messages/mark-all-read', async (req, res) => {
  const factionId = req.body.factionId as string;
  if (!factionId) {
    return res.status(400).json({ error: 'factionId required in request body' });
  }

  try {
    await markAllMessagesAsRead(factionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error marking all messages as read:', error);
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
});

// Season API endpoints

// GET /api/season - Get current season info
app.get('/api/season', (_req, res) => {
  const season = getCurrentSeason();
  const timeRemaining = getTimeRemaining();

  res.json({
    season,
    timeRemaining,
  });
});

// GET /api/season/rankings - Get current rankings
app.get('/api/season/rankings', (_req, res) => {
  try {
    const rankings = calculateRankings(gameState);
    res.json({ rankings });
  } catch (error) {
    console.error('[API] Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// GET /api/pantheon-hall - Get all past season winners
app.get('/api/pantheon-hall', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

  try {
    const winners = await getPantheonHall(limit);
    res.json({ winners });
  } catch (error) {
    console.error('[API] Error fetching Pantheon Hall:', error);
    res.status(500).json({ error: 'Failed to fetch Pantheon Hall' });
  }
});

// GET /api/legacy/:deityId - Get legacy records for a deity
app.get('/api/legacy/:deityId', async (req, res) => {
  const { deityId } = req.params;

  try {
    const legacy = await getDeityLegacy(deityId);
    res.json({ legacy });
  } catch (error) {
    console.error('[API] Error fetching deity legacy:', error);
    res.status(500).json({ error: 'Failed to fetch deity legacy' });
  }
});

// Mythology API endpoints

// GET /api/myths/faction/:factionId - Get myths for a faction
app.get('/api/myths/faction/:factionId', async (req, res) => {
  const { factionId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  try {
    const myths = await getFactionMyths(factionId, limit);
    res.json({ myths });
  } catch (error) {
    console.error('[API] Error fetching faction myths:', error);
    res.status(500).json({ error: 'Failed to fetch myths' });
  }
});

// GET /api/myths/shard/:shardId - Get all myths for a shard
app.get('/api/myths/shard/:shardId', async (req, res) => {
  const { shardId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  try {
    const myths = await getShardMyths(shardId, limit);
    res.json({ myths });
  } catch (error) {
    console.error('[API] Error fetching shard myths:', error);
    res.status(500).json({ error: 'Failed to fetch myths' });
  }
});

// GET /api/myths/notable - Get notable myths for current shard
app.get('/api/myths/notable', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const shardId = gameState.shardId;

  if (!shardId) {
    return res.status(400).json({ error: 'No active shard' });
  }

  try {
    const myths = await getNotableMyths(shardId, limit);
    res.json({ myths });
  } catch (error) {
    console.error('[API] Error fetching notable myths:', error);
    res.status(500).json({ error: 'Failed to fetch notable myths' });
  }
});

// POST /api/myths/:mythId/view - Record a myth view
app.post('/api/myths/:mythId/view', async (req, res) => {
  const { mythId } = req.params;

  try {
    await recordMythView(mythId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error recording myth view:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// POST /api/myths/:mythId/share - Record a myth share
app.post('/api/myths/:mythId/share', async (req, res) => {
  const { mythId } = req.params;

  try {
    await recordMythShare(mythId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error recording myth share:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// Champion API endpoints

// GET /api/champions/faction/:factionId - Get champions for a faction
app.get('/api/champions/faction/:factionId', async (req, res) => {
  const { factionId } = req.params;
  const aliveOnly = req.query.aliveOnly !== 'false';

  try {
    const champions = await getFactionChampions(factionId, aliveOnly);
    res.json({ champions });
  } catch (error) {
    console.error('[API] Error fetching faction champions:', error);
    res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

// GET /api/champions/:championId - Get a specific champion
app.get('/api/champions/:championId', async (req, res) => {
  const { championId } = req.params;

  try {
    const champion = await getChampionById(championId);
    if (!champion) {
      return res.status(404).json({ error: 'Champion not found' });
    }
    res.json({ champion });
  } catch (error) {
    console.error('[API] Error fetching champion:', error);
    res.status(500).json({ error: 'Failed to fetch champion' });
  }
});

// POST /api/champions/:championId/bless - Bless a champion
app.post('/api/champions/:championId/bless', async (req, res) => {
  const { championId } = req.params;
  const { factionId } = req.body;

  if (!factionId) {
    return res.status(400).json({ error: 'factionId required in request body' });
  }

  const faction = gameState.factions.get(factionId);
  if (!faction) {
    return res.status(404).json({ error: 'Faction not found' });
  }

  try {
    const result = await blessChampion(gameState, faction, championId);
    if (result.success) {
      // Deduct divine power
      faction.divinePower -= CHAMPION_BLESS_COST;
      res.json({ success: true, champion: result.champion });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('[API] Error blessing champion:', error);
    res.status(500).json({ error: 'Failed to bless champion' });
  }
});

// POST /api/champions/:championId/assign - Assign champion to army
app.post('/api/champions/:championId/assign', async (req, res) => {
  const { championId } = req.params;
  const { armyId } = req.body; // armyId can be null to unassign

  try {
    const result = await assignChampionToArmy(championId, armyId ?? null);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('[API] Error assigning champion:', error);
    res.status(500).json({ error: 'Failed to assign champion' });
  }
});

// Create HTTP server
const server = createServer(app);

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log('Received:', data.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

/**
 * Initialize the game server
 */
async function initializeServer(): Promise<void> {
  // Try to load existing game state from database
  if (isSupabaseConfigured()) {
    const shardId = process.env.SHARD_ID;
    if (shardId) {
      console.log(`[Server] Attempting to load shard: ${shardId}`);
      const loadedState = await loadGameState(shardId);
      if (loadedState) {
        gameState = loadedState;
        console.log(`[Server] Loaded existing game state at tick ${gameState.tick}`);

        // Initialize or load the current season
        const season = await initializeSeason(gameState);
        if (season) {
          console.log(`[Server] Season active: ${season.name}`);
        }
      } else {
        console.log('[Server] No existing state found, starting fresh');
      }
    }
  }

  // Create and configure ticker
  ticker = new Ticker(gameState, {
    onSpecializationTick: (state) => {
      // Check for specialization unlocks (every 10 ticks to reduce overhead)
      if (state.tick % 10 === 0) {
        processSpecializationTick(state);
      }
    },
    onChampionTick: async (state) => {
      // Process champion spawning and aging
      await processChampionSpawning(state);
      await processChampionAging(state);
    },
    onSeasonTick: async (state) => {
      // Process season victory conditions and dominance tracking
      await processSeasonTick(state);
    },
    onPersistence: async (state) => {
      if (shouldSaveOnTick(state.tick)) {
        try {
          await saveGameState(state);
        } catch (error) {
          console.error('[Server] Failed to persist state:', error);
        }
      }
    },
    onBroadcastState: (state) => {
      // Get current season info for broadcast
      const season = getCurrentSeason();

      // Broadcast state to all connected WebSocket clients
      const message = JSON.stringify({
        type: 'world_state',
        payload: {
          tick: state.tick,
          season: season ? {
            id: season.id,
            name: season.name,
            status: season.status,
            endsAt: season.endsAt,
            timeRemaining: getTimeRemaining(),
          } : null,
        },
        timestamp: Date.now(),
      });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    },
  });

  // Start the ticker
  ticker.start();
  console.log('[Server] Game ticker started');
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('[Server] Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n[Server] Received ${signal}, starting graceful shutdown...`);

  // Stop the ticker
  if (ticker) {
    ticker.stop();
    console.log('[Server] Ticker stopped');
  }

  // Save full game state to database
  if (isSupabaseConfigured() && gameState.shardId) {
    console.log('[Server] Saving final game state...');
    try {
      await saveFullState(gameState);
      console.log('[Server] Game state saved successfully');
    } catch (error) {
      console.error('[Server] Failed to save game state:', error);
    }
  }

  // Close WebSocket connections
  console.log('[Server] Closing WebSocket connections...');
  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down');
  });

  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed');
    console.log('[Server] Graceful shutdown complete');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Pantheon game server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Initialize server after HTTP is ready
  initializeServer().catch((error) => {
    console.error('[Server] Failed to initialize:', error);
    process.exit(1);
  });
});
