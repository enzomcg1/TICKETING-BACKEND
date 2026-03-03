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
import { getAllowedOrigins, isOriginAllowed, isProduction } from './config/security';
import { securityHeaders } from './middleware/security';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const allowedOrigins = getAllowedOrigins();

if (isProduction() && allowedOrigins.length === 0) {
  throw new Error('FRONTEND_URL es obligatorio en produccion');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Inicializar Socket.IO
initializeSocket(httpServer);

// Middlewares
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Permitir solicitudes sin origen (health checks/scripts)
    if (!origin) return callback(null, true);

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    console.log(`[CORS] Origen no permitido: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
};

app.use(securityHeaders);
app.use(cors(corsOptions));

app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir archivos estaticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes publicas
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

// Ruta raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Gestion de Tickets - API Backend',
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
    documentation: 'Visita /api/health para mas informacion',
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket.IO initialized');
  console.log('Server accessible on:');
  console.log(`   - http://localhost:${PORT}`);
  console.log(`   - http://0.0.0.0:${PORT}`);
  console.log(`   - http://[YOUR_LOCAL_IP]:${PORT}`);
});
