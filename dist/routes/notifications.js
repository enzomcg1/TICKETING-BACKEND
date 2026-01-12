"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /api/notifications - Obtener notificaciones del usuario actual
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { unreadOnly } = req.query;
        const where = {
            userId: user.id,
        };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }
        const notifications = await database_1.default.notification.findMany({
            where,
            include: {
                ticket: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limitar a las últimas 50
        });
        // Filtrar notificaciones con tickets válidos (evitar errores si un ticket fue eliminado)
        const validNotifications = notifications.filter(n => n.ticket !== null);
        const unreadCount = await database_1.default.notification.count({
            where: {
                userId: user.id,
                isRead: false,
            },
        });
        res.json({
            notifications: validNotifications,
            unreadCount,
        });
    }
    catch (error) {
        console.error('Error al obtener notificaciones:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Error al obtener notificaciones',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
// PUT /api/notifications/:id/read - Marcar notificación como leída
router.put('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        console.log(`[PUT /notifications/:id/read] Marcando notificación ${id} como leída por usuario ${user.id}`);
        const notification = await database_1.default.notification.findUnique({
            where: { id },
        });
        if (!notification) {
            console.log(`[PUT /notifications/:id/read] Notificación ${id} no encontrada`);
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        if (notification.userId !== user.id) {
            console.log(`[PUT /notifications/:id/read] Usuario ${user.id} intentó marcar notificación de usuario ${notification.userId}`);
            return res.status(403).json({ error: 'No tiene permisos para esta notificación' });
        }
        const updated = await database_1.default.notification.update({
            where: { id },
            data: { isRead: true },
        });
        console.log(`[PUT /notifications/:id/read] Notificación ${id} marcada como leída exitosamente`);
        res.json(updated);
    }
    catch (error) {
        console.error('Error al marcar notificación como leída:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Error al marcar notificación como leída',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
// PUT /api/notifications/read-all - Marcar todas las notificaciones como leídas
router.put('/read-all', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        console.log(`[PUT /notifications/read-all] Marcando todas las notificaciones como leídas para usuario ${user.id}`);
        const result = await database_1.default.notification.updateMany({
            where: {
                userId: user.id,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        console.log(`[PUT /notifications/read-all] ${result.count} notificaciones marcadas como leídas`);
        res.json({
            message: 'Todas las notificaciones marcadas como leídas',
            count: result.count
        });
    }
    catch (error) {
        console.error('Error al marcar todas las notificaciones como leídas:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Error al marcar notificaciones como leídas',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
exports.default = router;
