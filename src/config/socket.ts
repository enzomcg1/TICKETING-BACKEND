import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { hasConfiguredAllowedOrigins, isOriginAllowed, isProduction } from './security';

let io: SocketIOServer | null = null;

export const initializeSocket = (httpServer: HTTPServer) => {
  if (isProduction() && !hasConfiguredAllowedOrigins()) {
    throw new Error('FRONTEND_URL o FRONTEND_ORIGIN_PATTERNS es obligatorio en produccion para Socket.IO');
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by Socket.IO CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-user-room', (userId: string) => {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};
