import express from 'express';
import prisma from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/logs - Obtener logs (administrador y auditor)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Verificar permisos: ADMIN y AUDITOR pueden ver logs
    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      return res.status(403).json({ error: 'No tiene permisos para ver logs' });
    }
    
    const {
      level,
      category,
      userId,
      ticketId,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (level && ['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(level as string)) {
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
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
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
      prisma.systemLog.count({ where }),
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
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

// GET /api/logs/stats - Obtener estadísticas de logs (administrador y auditor)
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Verificar permisos: ADMIN y AUDITOR pueden ver logs
    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      return res.status(403).json({ error: 'No tiene permisos para ver logs' });
    }
    
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [total, byLevel, byCategory, recentErrors] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.groupBy({
        by: ['level'],
        where,
        _count: { id: true },
      }),
      prisma.systemLog.groupBy({
        by: ['category'],
        where,
        _count: { id: true },
      }),
      prisma.systemLog.findMany({
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
  } catch (error) {
    console.error('Error al obtener estadísticas de logs:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de logs' });
  }
});

// DELETE /api/logs/:id - Eliminar un log específico (solo administrador)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.systemLog.delete({
      where: { id },
    });
    res.json({ message: 'Log eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar log:', error);
    res.status(500).json({ error: 'Error al eliminar log' });
  }
});

// DELETE /api/logs - Limpiar logs antiguos (solo administrador)
router.delete('/', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const result = await prisma.systemLog.deleteMany({
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
  } catch (error) {
    console.error('Error al limpiar logs:', error);
    res.status(500).json({ error: 'Error al limpiar logs' });
  }
});

export default router;

