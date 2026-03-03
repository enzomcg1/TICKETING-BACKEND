"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const security_1 = require("./security");
let io = null;
const initializeSocket = (httpServer) => {
    const allowedOrigins = (0, security_1.getAllowedOrigins)();
    if ((0, security_1.isProduction)() && allowedOrigins.length === 0) {
        throw new Error('FRONTEND_URL es obligatorio en produccion para Socket.IO');
    }
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || (0, security_1.isOriginAllowed)(origin)) {
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
