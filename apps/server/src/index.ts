import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log('Received:', data.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`Pantheon game server running on port ${PORT}`);
