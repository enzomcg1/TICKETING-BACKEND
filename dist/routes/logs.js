"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /api/logs - Obtener logs (administrador y auditor)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        // Verificar permisos: ADMIN y AUDITOR pueden ver logs
        if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
            return res.status(403).json({ error: 'No tiene permisos para ver logs' });
        }
        const { level, category, userId, ticketId, startDate, endDate, page = '1', limit = '50', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (level && ['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(level)) {
            where.level = level;
        }
        if (category) {
            where.category = category;
        }
        if (userId) {
            where.userId = userId;
        }
        if (ticketId) {
            where.ticketId = ticketId;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }
        const [logs, total] = await Promise.all([
            database_1.default.systemLog.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                    ticket: {
                        select: { id: true, title: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            database_1.default.systemLog.count({ where }),
        ]);
        res.json({
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});
// GET /api/logs/stats - Obtener estadísticas de logs (administrador y auditor)
router.get('/stats', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        // Verificar permisos: ADMIN y AUDITOR pueden ver logs
        if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
            return res.status(403).json({ error: 'No tiene permisos para ver logs' });
        }
        const { startDate, endDate } = req.query;
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }
        const [total, byLevel, byCategory, recentErrors] = await Promise.all([
            database_1.default.systemLog.count({ where }),
            database_1.default.systemLog.groupBy({
                by: ['level'],
                where,
                _count: { id: true },
            }),
            database_1.default.systemLog.groupBy({
                by: ['category'],
                where,
                _count: { id: true },
            }),
            database_1.default.systemLog.findMany({
                where: { ...where, level: 'ERROR' },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
            }),
        ]);
        res.json({
            total,
            byLevel: byLevel.map((item) => ({
                level: item.level,
                count: item._count.id,
            })),
            byCategory: byCategory.map((item) => ({
                category: item.category,
                count: item._count.id,
            })),
            recentErrors,
        });
    }
    catch (error) {
        console.error('Error al obtener estadísticas de logs:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de logs' });
    }
});
// DELETE /api/logs/:id - Eliminar un log específico (solo administrador)
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.systemLog.delete({
            where: { id },
        });
        res.json({ message: 'Log eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar log:', error);
        res.status(500).json({ error: 'Error al eliminar log' });
    }
});
// DELETE /api/logs - Limpiar logs antiguos (solo administrador)
router.delete('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { days = '30' } = req.query;
        const daysNum = parseInt(days, 10);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);
        const result = await database_1.default.systemLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });
        res.json({
            message: `${result.count} logs eliminados`,
            deletedCount: result.count,
        });
    }
    catch (error) {
        console.error('Error al limpiar logs:', error);
        res.status(500).json({ error: 'Error al limpiar logs' });
    }
});
exports.default = router;
