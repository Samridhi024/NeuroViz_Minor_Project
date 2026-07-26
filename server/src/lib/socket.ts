import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from './logger.js';

let io: SocketServer;

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join user-specific room for notifications
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.debug(`User ${userId} joined room`);
    });

    // Join order tracking room
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
      logger.debug(`Joined order tracking: ${orderId}`);
    });

    // Delivery partner location updates
    socket.on('delivery:location', (data: { orderId: string; lat: number; lng: number }) => {
      io.to(`order:${data.orderId}`).emit('delivery:location:update', {
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
