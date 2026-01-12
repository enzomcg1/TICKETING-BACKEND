import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

// Extender el tipo Request para incluir el usuario
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    branchId?: string;
    departmentId?: string;
  };
}

// Middleware de autenticación JWT
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    
    // Verificar que el usuario aún existe en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        departmentId: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Agregar información del usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId || undefined,
      departmentId: user.departmentId || undefined,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware de autorización por roles
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tiene permisos para realizar esta acción' 
      });
    }

    next();
  };
};

// Helpers para verificar permisos específicos según la nueva jerarquía de roles
export const canViewAllTickets = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // ADMIN y AUDITOR pueden ver todos los tickets
  return ['ADMIN', 'AUDITOR'].includes(user.role);
};

export const canViewBranchTickets = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // ADMIN, SUPERVISOR y AUDITOR pueden ver tickets de sucursal
  return ['ADMIN', 'SUPERVISOR', 'AUDITOR'].includes(user.role);
};

export const canViewDepartmentTickets = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // ADMIN, SUPERVISOR, TECHNICIAN y AUDITOR pueden ver tickets de departamento
  return ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'AUDITOR'].includes(user.role);
};

export const canEditTicket = (user: AuthRequest['user'], ticket: any): boolean => {
  if (!user) return false;
  
  // ADMIN → acceso total
  if (user.role === 'ADMIN') return true;
  
  // AUDITOR → no puede editar (solo lectura)
  if (user.role === 'AUDITOR') return false;
  
  // TECHNICIAN → mismo acceso que ADMIN para editar tickets (puede editar cualquier ticket que pueda ver)
  if (user.role === 'TECHNICIAN') {
    // Puede editar tickets asignados a él
    if (ticket.assignedToId === user.id) return true;
    // Puede editar tickets OPEN sin asignar
    if (ticket.status === 'OPEN' && !ticket.assignedToId) return true;
    // Puede editar tickets creados por USER (rol inferior)
    if (ticket.requestedBy && ticket.requestedBy.role === 'USER') return true;
    // Por defecto, si el técnico puede ver el ticket, puede editarlo
    return true;
  }
  
  // USER → puede editar sus propios tickets (agregar comentarios), pero no cambiar estado ni reasignar
  if (user.role === 'USER' && ticket.requestedById === user.id) return true;
  
  // SUPERVISOR → puede editar tickets de su área/sucursal
  if (user.role === 'SUPERVISOR') {
    if (user.branchId && ticket.branchId === user.branchId) return true;
    if (user.departmentId && ticket.departmentId === user.departmentId) return true;
  }
  
  return false;
};

export const canAssignTicket = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // ADMIN y SUPERVISOR pueden asignar/reasignar tickets
  return ['ADMIN', 'SUPERVISOR'].includes(user.role);
};

export const canChangeTicketStatus = (user: AuthRequest['user'], ticket: any): boolean => {
  if (!user) return false;
  
  // ADMIN → siempre permitido
  if (user.role === 'ADMIN') return true;
  
  // AUDITOR y USER → denegar (403)
  if (user.role === 'AUDITOR' || user.role === 'USER') return false;
  
  // SUPERVISOR → si el ticket pertenece a su área
  if (user.role === 'SUPERVISOR') {
    if (user.branchId && ticket.branchId === user.branchId) return true;
    if (user.departmentId && ticket.departmentId === user.departmentId) return true;
    return false;
  }
  
  // TECHNICIAN → puede cambiar estado de cualquier ticket que puede ver:
  // - Tickets asignados a él
  // - Tickets OPEN sin asignar (para auto-asignarse)
  // - Tickets creados por USER (rol inferior)
  // - Cualquier otro ticket visible para técnicos
  if (user.role === 'TECHNICIAN') {
    // Tickets asignados a él
    if (ticket.assignedToId === user.id) return true;
    // Tickets OPEN sin asignar (para auto-asignarse)
    if (ticket.status === 'OPEN' && !ticket.assignedToId) return true;
    // Tickets creados por USER (rol inferior) - los técnicos pueden ver y cambiar todos los tickets de USER
    if (ticket.requestedBy && ticket.requestedBy.role === 'USER') return true;
    // Si el técnico puede ver el ticket, también puede cambiar su estado
    // (la validación específica de transiciones se hace en statusService)
    return true;
  }
  
  return false;
};

export const canCreateUser = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // Solo ADMIN puede crear usuarios
  return user.role === 'ADMIN';
};

export const canDeleteUser = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // Solo ADMIN puede eliminar usuarios
  return user.role === 'ADMIN';
};

export const canManageConfig = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // Solo ADMIN puede gestionar configuración
  return user.role === 'ADMIN';
};

export const canCreateTicket = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // Todos los roles autenticados pueden crear tickets, excepto AUDITOR
  return user.role !== 'AUDITOR';
};

export const canAddComment = (user: AuthRequest['user'], ticket: any): boolean => {
  if (!user) return false;
  
  // AUDITOR → no puede agregar comentarios (solo lectura)
  if (user.role === 'AUDITOR') return false;
  
  // USER → puede agregar comentarios a sus propios tickets
  if (user.role === 'USER' && ticket.requestedById === user.id) return true;
  
  // TECHNICIAN → puede agregar comentarios a cualquier ticket que pueda ver
  // (similar a canEditTicket: puede comentar tickets asignados, OPEN sin asignar, o cualquier ticket visible)
  if (user.role === 'TECHNICIAN') {
    // Puede comentar tickets asignados a él
    if (ticket.assignedToId === user.id) return true;
    // Puede comentar tickets OPEN sin asignar (para auto-asignarse)
    if (ticket.status === 'OPEN' && !ticket.assignedToId) return true;
    // Puede comentar tickets creados por USER (rol inferior)
    if (ticket.requestedBy && ticket.requestedBy.role === 'USER') return true;
    // Por defecto, si el técnico puede ver el ticket, puede comentarlo
    return true;
  }
  
  // SUPERVISOR → puede agregar comentarios a tickets de su área
  if (user.role === 'SUPERVISOR') {
    if (user.branchId && ticket.branchId === user.branchId) return true;
    if (user.departmentId && ticket.departmentId === user.departmentId) return true;
    return false;
  }
  
  // ADMIN → puede agregar comentarios a todos los tickets
  if (user.role === 'ADMIN') return true;
  
  return false;
};

export const canDeleteTicket = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // Solo ADMIN puede eliminar tickets
  return user.role === 'ADMIN';
};

export const canViewLogs = (user: AuthRequest['user']): boolean => {
  if (!user) return false;
  // ADMIN y AUDITOR pueden ver logs
  return ['ADMIN', 'AUDITOR'].includes(user.role);
};

