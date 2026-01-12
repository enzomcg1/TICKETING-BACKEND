import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { loggerService } from '../services/loggerService';

const router = express.Router();

// GET /api/users - Listar todos los usuarios (solo ADMIN y SUPERVISOR)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo ADMIN, SUPERVISOR y AUDITOR pueden ver la lista de usuarios
    if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'AUDITOR') {
      return res.status(403).json({ error: 'No tienes permisos para ver usuarios' });
    }

    let where: any = {};
    
    // SUPERVISOR solo ve usuarios de su sucursal/departamento
    if (user.role === 'SUPERVISOR') {
      const conditions: any[] = [];
      if (user.branchId) {
        conditions.push({ branchId: user.branchId });
      }
      if (user.departmentId) {
        conditions.push({ departmentId: user.departmentId });
      }
      if (conditions.length > 0) {
        where.OR = conditions;
      } else {
        // Si no tiene branchId ni departmentId, no puede ver ningún usuario
        where.id = 'impossible-id-that-will-not-match';
      }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/users/branch - Obtener usuarios agrupados por sucursal
router.get('/branch', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo ADMIN, SUPERVISOR y AUDITOR pueden ver esta información
    if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'AUDITOR') {
      return res.status(403).json({ error: 'No tienes permisos para ver esta información' });
    }

    let where: any = {};
    
    // SUPERVISOR solo ve usuarios de su sucursal
    if (user.role === 'SUPERVISOR' && user.branchId) {
      where.branchId = user.branchId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            createdTickets: true,
            assignedTickets: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Agrupar por sucursal
    const branchMap = new Map();
    
    users.forEach((user) => {
      const branchId = user.branchId || 'sin-sucursal';
      const branchName = user.branch?.name || 'Sin Sucursal';
      const branchCode = user.branch?.code || 'N/A';
      
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          branch: user.branchId
            ? {
                id: user.branchId,
                name: branchName,
                code: branchCode,
              }
            : null,
          users: [],
          totalUsers: 0,
        });
      }
      
      const branchData = branchMap.get(branchId);
      branchData.users.push({
        ...user,
        ticketsCreated: user._count.createdTickets,
        ticketsAssigned: user._count.assignedTickets,
        totalTickets: user._count.createdTickets + user._count.assignedTickets,
      });
      branchData.totalUsers = branchData.users.length;
    });

    // Convertir a array
    const result = Array.from(branchMap.values());

    res.json(result);
  } catch (error) {
    console.error('Error al obtener usuarios por sucursal:', error);
    res.status(500).json({ error: 'Error al obtener usuarios por sucursal' });
  }
});

// GET /api/users/:id - Obtener un usuario específico
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Los usuarios solo pueden ver su propia información, excepto ADMIN, SUPERVISOR y AUDITOR
    if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'AUDITOR' && user.id !== id) {
      return res.status(403).json({ error: 'No tienes permisos para ver este usuario' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // SUPERVISOR solo puede ver usuarios de su sucursal/departamento
    if (user.role === 'SUPERVISOR') {
      if (
        (user.branchId && targetUser.branchId !== user.branchId) &&
        (user.departmentId && targetUser.departmentId !== user.departmentId)
      ) {
        return res.status(403).json({ error: 'No tienes permisos para ver este usuario' });
      }
    }

    res.json(targetUser);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Función helper para determinar jerarquía de roles
const getRoleHierarchy = (role: string): number => {
  const hierarchy: Record<string, number> = {
    ADMIN: 5,
    SUPERVISOR: 4,
    TECHNICIAN: 3,
    AUDITOR: 2,
    USER: 1,
  };
  return hierarchy[role] || 0;
};

// PUT /api/users/:id/password - Cambiar contraseña de un usuario (solo ADMIN)
// Esta ruta debe estar antes de PUT /:id para que Express la capture correctamente
router.put('/:id/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { newPassword } = req.body;

    // Solo ADMIN puede cambiar contraseñas de otros usuarios
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden cambiar contraseñas de otros usuarios' });
    }

    if (!newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña es requerida' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar que el usuario objetivo tenga un rol inferior al ADMIN
    const userHierarchy = getRoleHierarchy(user.role);
    const targetHierarchy = getRoleHierarchy(targetUser.role);
    
    if (targetHierarchy >= userHierarchy) {
      return res.status(403).json({ 
        error: 'Solo puedes cambiar la contraseña de usuarios con roles inferiores al tuyo' 
      });
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      }
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PUT /api/users/:id - Actualizar un usuario
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { name, role, departmentId, branchId, isActive } = req.body;

    // Solo ADMIN puede actualizar usuarios
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden actualizar usuarios' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar que el usuario objetivo tenga un rol inferior al ADMIN
    const userHierarchy = getRoleHierarchy(user.role);
    const targetHierarchy = getRoleHierarchy(targetUser.role);
    
    if (targetHierarchy >= userHierarchy) {
      return res.status(403).json({ 
        error: 'Solo puedes editar usuarios con roles inferiores al tuyo' 
      });
    }

    // Si se está cambiando el rol, validar que el nuevo rol también sea inferior
    if (role !== undefined && role !== targetUser.role) {
      const newRoleHierarchy = getRoleHierarchy(role);
      if (newRoleHierarchy >= userHierarchy) {
        return res.status(403).json({ 
          error: 'No puedes asignar un rol igual o superior al tuyo' 
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (branchId !== undefined) updateData.branchId = branchId || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id - Eliminar un usuario (solo ADMIN)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Solo ADMIN puede eliminar usuarios
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios' });
    }

    // No permitir eliminar el propio usuario
    if (user.id === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            createdTickets: true,
            assignedTickets: true,
            comments: true,
            notifications: true,
            systemLogs: true,
            ticketHistory: true,
            uploadedAttachments: true,
            processedRequests: true,
          }
        }
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar que el usuario objetivo tenga un rol inferior al ADMIN
    const userHierarchy = getRoleHierarchy(user.role);
    const targetHierarchy = getRoleHierarchy(targetUser.role);
    
    if (targetHierarchy >= userHierarchy) {
      return res.status(403).json({ 
        error: 'Solo puedes eliminar usuarios con roles inferiores al tuyo' 
      });
    }

    // Verificar si el usuario tiene tickets creados o asignados
    // Estos son datos críticos que no deberían perderse
    const hasCreatedTickets = targetUser._count.createdTickets > 0;
    const hasAssignedTickets = targetUser._count.assignedTickets > 0;

    if (hasCreatedTickets || hasAssignedTickets) {
      const details: string[] = [];
      if (hasCreatedTickets) {
        details.push(`${targetUser._count.createdTickets} ticket(s) creado(s)`);
      }
      if (hasAssignedTickets) {
        details.push(`${targetUser._count.assignedTickets} ticket(s) asignado(s)`);
      }
      
      return res.status(400).json({ 
        error: `No se puede eliminar este usuario porque tiene ${details.join(' y ')}. Por favor, desactívelo en lugar de eliminarlo, o reasigne los tickets antes de eliminar.`,
        details: {
          createdTickets: targetUser._count.createdTickets,
          assignedTickets: targetUser._count.assignedTickets,
        }
      });
    }

    // Si tiene otras relaciones menores, las eliminamos primero
    // Notificaciones - se eliminan en cascada automáticamente (onDelete: Cascade)
    // Logs del sistema - se establecen en null automáticamente (onDelete: SetNull)
    
    // Actualizar solicitudes procesadas para establecer processedById en null
    if (targetUser._count.processedRequests > 0) {
      await prisma.userRequest.updateMany({
        where: { processedById: id },
        data: { processedById: null }
      });
    }

    // Eliminar historial de tickets del usuario
    if (targetUser._count.ticketHistory > 0) {
      await prisma.ticketHistory.deleteMany({
        where: { changedBy: id }
      });
    }

    // Manejar adjuntos del usuario
    // Nota: Los adjuntos asociados a comentarios se eliminarán automáticamente
    // cuando eliminemos los comentarios (onDelete: Cascade)
    // Solo necesitamos manejar los adjuntos directamente asociados a tickets
    if (targetUser._count.uploadedAttachments > 0) {
      // Buscar otro usuario ADMIN para reasignar adjuntos
      // (no podemos usar null porque uploadedById es requerido)
      const alternativeUser = await prisma.user.findFirst({
        where: {
          id: { not: id },
          role: 'ADMIN',
          isActive: true
        },
        select: { id: true }
      });

      if (alternativeUser) {
        // Reasignar adjuntos directamente asociados a tickets (sin comentario)
        // Los adjuntos asociados a comentarios se eliminarán cuando eliminemos los comentarios
        await prisma.attachment.updateMany({
          where: {
            uploadedById: id,
            commentId: null // Solo adjuntos directamente en tickets
          },
          data: { uploadedById: alternativeUser.id }
        });

        // Para adjuntos asociados a comentarios, no hacemos nada aquí
        // porque se eliminarán cuando eliminemos los comentarios
      } else {
        // Si no hay usuario alternativo, eliminar solo los adjuntos directamente asociados a tickets
        // Los adjuntos asociados a comentarios se eliminarán cuando eliminemos los comentarios
        await prisma.attachment.deleteMany({
          where: {
            uploadedById: id,
            commentId: null // Solo adjuntos directamente en tickets
          }
        });
      }
    }

    // Eliminar comentarios del usuario
    // Esto eliminará automáticamente los adjuntos asociados a los comentarios (onDelete: Cascade)
    if (targetUser._count.comments > 0) {
      await prisma.comment.deleteMany({
        where: { userId: id }
      });
    }

    // Guardar información del usuario antes de eliminarlo para el log
    const userEmail = targetUser.email;
    const userName = targetUser.name;
    const userRole = targetUser.role;

    // Ahora podemos eliminar el usuario
    await prisma.user.delete({
      where: { id },
    });

    // Registrar evento en el historial
    const requestInfo = loggerService.extractRequestInfo(req);
    loggerService.info(
      `Usuario eliminado: ${userName} (${userEmail}) con rol ${userRole}`,
      'USER',
      {
        userId: user.id,
        metadata: {
          deletedUserId: id,
          deletedUserEmail: userEmail,
          deletedUserName: userName,
          deletedUserRole: userRole,
        },
        ...requestInfo,
      }
    ).catch(err => console.error('Error al registrar log de eliminación de usuario:', err));

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error: any) {
    console.error('Error al eliminar usuario:', error);
    
    // Si es un error de clave foránea, proporcionar un mensaje más descriptivo
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'No se puede eliminar este usuario porque tiene relaciones activas en el sistema. Por favor, desactívelo en lugar de eliminarlo, o contacte al administrador del sistema.' 
      });
    }

    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

export default router;
