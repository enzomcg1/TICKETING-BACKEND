"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initializeSocket = (httpServer) => {
    // Permitir múltiples orígenes para túneles
    const allowedOrigins = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
        : ['http://localhost:5173'];
    // Si estamos en modo desarrollo o hay URL de túnel, permitir cualquier origen
    // También permitir DevTunnels y otros servicios de túnel
    const corsOrigin = process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL
        ? allowedOrigins
        : true; // Permitir cualquier origen en desarrollo/túneles (incluyendo DevTunnels)
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: corsOrigin,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        // Unirse a una sala por userId
        socket.on('join-user-room', (userId) => {
            socket.join(`user-${userId}`);
            console.log(`User ${userId} joined their room`);
        });
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};
exports.getIO = getIO;
