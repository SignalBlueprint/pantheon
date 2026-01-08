import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { isSupabaseConfigured } from './db/supabase.js';
import { saveFullState, shouldSaveOnTick, saveGameState, loadGameState } from './db/persistence.js';
import { Ticker, createInitialGameState } from './simulation/ticker.js';
import { GameState } from '@pantheon/shared';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

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
      } else {
        console.log('[Server] No existing state found, starting fresh');
      }
    }
  }

  // Create and configure ticker
  ticker = new Ticker(gameState, {
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
      // Broadcast state to all connected WebSocket clients
      const message = JSON.stringify({
        type: 'world_state',
        payload: { tick: state.tick },
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
