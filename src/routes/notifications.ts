import express from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/notifications - Obtener notificaciones del usuario actual
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { unreadOnly } = req.query;

    const where: any = {
      userId: user.id,
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
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

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    res.json({
      notifications: validNotifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Error al obtener notificaciones:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al obtener notificaciones',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/notifications/:id/read - Marcar notificación como leída
router.put('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    console.log(`[PUT /notifications/:id/read] Marcando notificación ${id} como leída por usuario ${user.id}`);

    const notification = await prisma.notification.findUnique({
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

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    console.log(`[PUT /notifications/:id/read] Notificación ${id} marcada como leída exitosamente`);
    res.json(updated);
  } catch (error: any) {
    console.error('Error al marcar notificación como leída:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al marcar notificación como leída',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/notifications/read-all - Marcar todas las notificaciones como leídas
router.put('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    console.log(`[PUT /notifications/read-all] Marcando todas las notificaciones como leídas para usuario ${user.id}`);

    const result = await prisma.notification.updateMany({
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
  } catch (error: any) {
    console.error('Error al marcar todas las notificaciones como leídas:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al marcar notificaciones como leídas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

