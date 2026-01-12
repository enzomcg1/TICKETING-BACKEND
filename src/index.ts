import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';
import branchRoutes from './routes/branches';
import departmentRoutes from './routes/departments';
import authRoutes from './routes/auth';
import userRequestRoutes from './routes/userRequests';
import notificationRoutes from './routes/notifications';
import logRoutes from './routes/logs';
import attachmentRoutes from './routes/attachments';
import { initializeSocket } from './config/socket';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Inicializar Socket.IO
initializeSocket(httpServer);

// Middlewares
// Configurar CORS para permitir túneles (ngrok, etc.)
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Permitir solicitudes sin origen (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:5173', 'http://localhost:5174', 'http://192.168.100.4:5173'];
    
    // Permitir cualquier origen si no hay FRONTEND_URL definido (desarrollo)
    if (process.env.FRONTEND_URL === undefined || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Verificar si el origen está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permitir conexiones de localhost en cualquier puerto (desarrollo)
    const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
    if (isLocalhost) {
      return callback(null, true);
    }
    
    // Permitir conexiones de la red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    // Esto incluye redes VPN comunes (10.8.0.x para OpenVPN)
    const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(origin);
    if (isLocalNetwork) {
      return callback(null, true);
    }
    
    // Permitir conexiones de DevTunnels (Microsoft)
    // DevTunnels puede tener varios formatos: .devtunnels.ms, .brs.devtunnels.ms, etc.
    const isDevTunnels = /devtunnels\.ms/i.test(origin);
    if (isDevTunnels) {
      console.log(`[CORS] Permitiendo conexión desde DevTunnels: ${origin}`);
      return callback(null, true);
    }
    
    // Permitir conexiones de otros servicios de túnel comunes
    const isTunnelService = /\.(ngrok|localtunnel|cloudflared|ngrok-free|ngrok\.io)\./.test(origin);
    if (isTunnelService) {
      console.log(`[CORS] Permitiendo conexión desde túnel: ${origin}`);
      return callback(null, true);
    }
    
    console.log(`[CORS] Origen no permitido: ${origin}`);
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));

// Manejar solicitudes OPTIONS explícitamente (preflight)
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes públicas
app.use('/api/auth', authRoutes);
app.use('/api/user-requests', userRequestRoutes);

// Routes protegidas
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/attachments', attachmentRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistema de Gestión de Tickets - API Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      tickets: '/api/tickets',
      users: '/api/users',
      branches: '/api/branches',
      departments: '/api/departments',
      userRequests: '/api/user-requests',
      notifications: '/api/notifications',
      logs: '/api/logs',
      attachments: '/api/attachments'
    },
    documentation: 'Visita /api/health para más información',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is running',
    endpoints: {
      health: { path: '/api/health', status: 'funcionando correctamente' },
      auth: { path: '/api/auth', status: 'funcionando correctamente' },
      userRequests: { path: '/api/user-requests', status: 'funcionando correctamente' },
      tickets: { path: '/api/tickets', status: 'funcionando correctamente' },
      users: { path: '/api/users', status: 'funcionando correctamente' },
      branches: { path: '/api/branches', status: 'funcionando correctamente' },
      departments: { path: '/api/departments', status: 'funcionando correctamente' },
      notifications: { path: '/api/notifications', status: 'funcionando correctamente' },
      logs: { path: '/api/logs', status: 'funcionando correctamente' },
      attachments: { path: '/api/attachments', status: 'funcionando correctamente' }
    },
    timestamp: new Date().toISOString()
  });
});

// Escuchar en todas las interfaces de red (0.0.0.0)
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO initialized`);
  console.log(`🌐 Server accessible on:`);
  console.log(`   - http://localhost:${PORT}`);
  console.log(`   - http://0.0.0.0:${PORT}`);
  console.log(`   - http://[YOUR_LOCAL_IP]:${PORT} (access from network)`);
});

