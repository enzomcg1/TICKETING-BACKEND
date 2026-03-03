"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const tickets_1 = __importDefault(require("./routes/tickets"));
const users_1 = __importDefault(require("./routes/users"));
const branches_1 = __importDefault(require("./routes/branches"));
const departments_1 = __importDefault(require("./routes/departments"));
const auth_1 = __importDefault(require("./routes/auth"));
const userRequests_1 = __importDefault(require("./routes/userRequests"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const logs_1 = __importDefault(require("./routes/logs"));
const attachments_1 = __importDefault(require("./routes/attachments"));
const socket_1 = require("./config/socket");
const security_1 = require("./config/security");
const security_2 = require("./middleware/security");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const allowedOrigins = (0, security_1.getAllowedOrigins)();
if ((0, security_1.isProduction)() && allowedOrigins.length === 0) {
    throw new Error('FRONTEND_URL es obligatorio en produccion');
}
app.disable('x-powered-by');
app.set('trust proxy', 1);
// Inicializar Socket.IO
(0, socket_1.initializeSocket)(httpServer);
// Middlewares
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (health checks/scripts)
        if (!origin)
            return callback(null, true);
        if ((0, security_1.isOriginAllowed)(origin)) {
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
app.use(security_2.securityHeaders);
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Servir archivos estaticos (uploads)
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Routes publicas
app.use('/api/auth', auth_1.default);
app.use('/api/user-requests', userRequests_1.default);
// Routes protegidas
app.use('/api/tickets', tickets_1.default);
app.use('/api/users', users_1.default);
app.use('/api/branches', branches_1.default);
app.use('/api/departments', departments_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/logs', logs_1.default);
app.use('/api/attachments', attachments_1.default);
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
