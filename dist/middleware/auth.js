"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canViewLogs = exports.canDeleteTicket = exports.canAddComment = exports.canCreateTicket = exports.canManageConfig = exports.canDeleteUser = exports.canCreateUser = exports.canChangeTicketStatus = exports.canAssignTicket = exports.canEditTicket = exports.canViewDepartmentTickets = exports.canViewBranchTickets = exports.canViewAllTickets = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
// Middleware de autenticación JWT
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '');
        // Verificar que el usuario aún existe en la base de datos
        const user = await database_1.default.user.findUnique({
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
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
exports.authenticate = authenticate;
// Middleware de autorización por roles
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
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
exports.authorize = authorize;
// Helpers para verificar permisos específicos según la nueva jerarquía de roles
const canViewAllTickets = (user) => {
    if (!user)
        return false;
    // ADMIN y AUDITOR pueden ver todos los tickets
    return ['ADMIN', 'AUDITOR'].includes(user.role);
};
exports.canViewAllTickets = canViewAllTickets;
const canViewBranchTickets = (user) => {
    if (!user)
        return false;
    // ADMIN, SUPERVISOR y AUDITOR pueden ver tickets de sucursal
    return ['ADMIN', 'SUPERVISOR', 'AUDITOR'].includes(user.role);
};
exports.canViewBranchTickets = canViewBranchTickets;
const canViewDepartmentTickets = (user) => {
    if (!user)
        return false;
    // ADMIN, SUPERVISOR, TECHNICIAN y AUDITOR pueden ver tickets de departamento
    return ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'AUDITOR'].includes(user.role);
};
exports.canViewDepartmentTickets = canViewDepartmentTickets;
const canEditTicket = (user, ticket) => {
    if (!user)
        return false;
    // ADMIN → acceso total
    if (user.role === 'ADMIN')
        return true;
    // AUDITOR → no puede editar (solo lectura)
    if (user.role === 'AUDITOR')
        return false;
    // TECHNICIAN → mismo acceso que ADMIN para editar tickets (puede editar cualquier ticket que pueda ver)
    if (user.role === 'TECHNICIAN') {
        // Puede editar tickets asignados a él
        if (ticket.assignedToId === user.id)
            return true;
        // Puede editar tickets OPEN sin asignar
        if (ticket.status === 'OPEN' && !ticket.assignedToId)
            return true;
        // Puede editar tickets creados por USER (rol inferior)
        if (ticket.requestedBy && ticket.requestedBy.role === 'USER')
            return true;
        // Por defecto, si el técnico puede ver el ticket, puede editarlo
        return true;
    }
    // USER → puede editar sus propios tickets (agregar comentarios), pero no cambiar estado ni reasignar
    if (user.role === 'USER' && ticket.requestedById === user.id)
        return true;
    // SUPERVISOR → puede editar tickets de su área/sucursal
    if (user.role === 'SUPERVISOR') {
        if (user.branchId && ticket.branchId === user.branchId)
            return true;
        if (user.departmentId && ticket.departmentId === user.departmentId)
            return true;
    }
    return false;
};
exports.canEditTicket = canEditTicket;
const canAssignTicket = (user) => {
    if (!user)
        return false;
    // ADMIN y SUPERVISOR pueden asignar/reasignar tickets
    return ['ADMIN', 'SUPERVISOR'].includes(user.role);
};
exports.canAssignTicket = canAssignTicket;
const canChangeTicketStatus = (user, ticket) => {
    if (!user)
        return false;
    // ADMIN → siempre permitido
    if (user.role === 'ADMIN')
        return true;
    // AUDITOR y USER → denegar (403)
    if (user.role === 'AUDITOR' || user.role === 'USER')
        return false;
    // SUPERVISOR → si el ticket pertenece a su área
    if (user.role === 'SUPERVISOR') {
        if (user.branchId && ticket.branchId === user.branchId)
            return true;
        if (user.departmentId && ticket.departmentId === user.departmentId)
            return true;
        return false;
    }
    // TECHNICIAN → puede cambiar estado de cualquier ticket que puede ver:
    // - Tickets asignados a él
    // - Tickets OPEN sin asignar (para auto-asignarse)
    // - Tickets creados por USER (rol inferior)
    // - Cualquier otro ticket visible para técnicos
    if (user.role === 'TECHNICIAN') {
        // Tickets asignados a él
        if (ticket.assignedToId === user.id)
            return true;
        // Tickets OPEN sin asignar (para auto-asignarse)
        if (ticket.status === 'OPEN' && !ticket.assignedToId)
            return true;
        // Tickets creados por USER (rol inferior) - los técnicos pueden ver y cambiar todos los tickets de USER
        if (ticket.requestedBy && ticket.requestedBy.role === 'USER')
            return true;
        // Si el técnico puede ver el ticket, también puede cambiar su estado
        // (la validación específica de transiciones se hace en statusService)
        return true;
    }
    return false;
};
exports.canChangeTicketStatus = canChangeTicketStatus;
const canCreateUser = (user) => {
    if (!user)
        return false;
    // Solo ADMIN puede crear usuarios
    return user.role === 'ADMIN';
};
exports.canCreateUser = canCreateUser;
const canDeleteUser = (user) => {
    if (!user)
        return false;
    // Solo ADMIN puede eliminar usuarios
    return user.role === 'ADMIN';
};
exports.canDeleteUser = canDeleteUser;
const canManageConfig = (user) => {
    if (!user)
        return false;
    // Solo ADMIN puede gestionar configuración
    return user.role === 'ADMIN';
};
exports.canManageConfig = canManageConfig;
const canCreateTicket = (user) => {
    if (!user)
        return false;
    // Todos los roles autenticados pueden crear tickets, excepto AUDITOR
    return user.role !== 'AUDITOR';
};
exports.canCreateTicket = canCreateTicket;
const canAddComment = (user, ticket) => {
    if (!user)
        return false;
    // AUDITOR → no puede agregar comentarios (solo lectura)
    if (user.role === 'AUDITOR')
        return false;
    // USER → puede agregar comentarios a sus propios tickets
    if (user.role === 'USER' && ticket.requestedById === user.id)
        return true;
    // TECHNICIAN → puede agregar comentarios a cualquier ticket que pueda ver
    // (similar a canEditTicket: puede comentar tickets asignados, OPEN sin asignar, o cualquier ticket visible)
    if (user.role === 'TECHNICIAN') {
        // Puede comentar tickets asignados a él
        if (ticket.assignedToId === user.id)
            return true;
        // Puede comentar tickets OPEN sin asignar (para auto-asignarse)
        if (ticket.status === 'OPEN' && !ticket.assignedToId)
            return true;
        // Puede comentar tickets creados por USER (rol inferior)
        if (ticket.requestedBy && ticket.requestedBy.role === 'USER')
            return true;
        // Por defecto, si el técnico puede ver el ticket, puede comentarlo
        return true;
    }
    // SUPERVISOR → puede agregar comentarios a tickets de su área
    if (user.role === 'SUPERVISOR') {
        if (user.branchId && ticket.branchId === user.branchId)
            return true;
        if (user.departmentId && ticket.departmentId === user.departmentId)
            return true;
        return false;
    }
    // ADMIN → puede agregar comentarios a todos los tickets
    if (user.role === 'ADMIN')
        return true;
    return false;
};
exports.canAddComment = canAddComment;
const canDeleteTicket = (user) => {
    if (!user)
        return false;
    // Solo ADMIN puede eliminar tickets
    return user.role === 'ADMIN';
};
exports.canDeleteTicket = canDeleteTicket;
const canViewLogs = (user) => {
    if (!user)
        return false;
    // ADMIN y AUDITOR pueden ver logs
    return ['ADMIN', 'AUDITOR'].includes(user.role);
};
exports.canViewLogs = canViewLogs;
