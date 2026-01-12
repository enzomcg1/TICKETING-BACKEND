"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusLabels = void 0;
exports.canChangeStatus = canChangeStatus;
exports.getAvailableStatusTransitions = getAvailableStatusTransitions;
// Definir transiciones de estado permitidas por rol
const ALLOWED_TRANSITIONS = {
    ADMIN: {
        OPEN: ['ASSIGNED', 'CANCELLED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], // Acceso total
        ASSIGNED: ['IN_PROGRESS', 'PENDING', 'OPEN', 'CANCELLED', 'RESOLVED'],
        IN_PROGRESS: ['PENDING', 'RESOLVED', 'ASSIGNED', 'CANCELLED', 'CLOSED'],
        PENDING: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED', 'RESOLVED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS', 'ASSIGNED'],
        CLOSED: ['RESOLVED', 'IN_PROGRESS'], // administrador puede reabrir
        CANCELLED: ['OPEN', 'ASSIGNED'], // administrador puede reactivar
    },
    TECHNICIAN: {
        OPEN: ['ASSIGNED', 'CANCELLED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], // Mismo acceso que ADMIN
        ASSIGNED: ['IN_PROGRESS', 'PENDING', 'OPEN', 'CANCELLED', 'RESOLVED'],
        IN_PROGRESS: ['PENDING', 'RESOLVED', 'ASSIGNED', 'CANCELLED', 'CLOSED'],
        PENDING: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED', 'RESOLVED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS', 'ASSIGNED'],
        CLOSED: ['RESOLVED', 'IN_PROGRESS'], // Técnico puede reabrir
        CANCELLED: ['OPEN', 'ASSIGNED'], // Técnico puede reactivar
    },
    USER: {
        OPEN: ['CANCELLED'], // Usuario puede cancelar sus propios tickets
        ASSIGNED: [],
        IN_PROGRESS: [],
        PENDING: [],
        RESOLVED: ['CLOSED'], // Usuario puede cerrar tickets resueltos (confirmar cierre)
        CLOSED: [],
        CANCELLED: [],
    },
    SUPERVISOR: {
        OPEN: ['ASSIGNED', 'CANCELLED'], // Puede asignar y cancelar tickets de su área
        ASSIGNED: ['IN_PROGRESS', 'PENDING', 'OPEN', 'CANCELLED'],
        IN_PROGRESS: ['PENDING', 'RESOLVED', 'ASSIGNED'],
        PENDING: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS'],
        CLOSED: [],
        CANCELLED: [],
    },
    AUDITOR: {
        OPEN: [], // Solo lectura, no puede cambiar estados
        ASSIGNED: [],
        IN_PROGRESS: [],
        PENDING: [],
        RESOLVED: [],
        CLOSED: [],
        CANCELLED: [],
    },
};
function canChangeStatus(user, currentStatus, newStatus, ticket) {
    if (!user) {
        return { allowed: false, reason: 'Usuario no autenticado' };
    }
    // ADMIN puede cambiar a cualquier estado
    if (user.role === 'ADMIN') {
        const allowedStates = ALLOWED_TRANSITIONS.ADMIN[currentStatus] || [];
        if (allowedStates.includes(newStatus)) {
            return { allowed: true };
        }
        return { allowed: false, reason: `No se puede cambiar de ${currentStatus} a ${newStatus}` };
    }
    // AUDITOR no puede cambiar estados (solo lectura)
    if (user.role === 'AUDITOR') {
        return { allowed: false, reason: 'Los auditores no pueden modificar tickets (acceso de solo lectura)' };
    }
    // USER no puede cambiar estados, excepto cerrar tickets resueltos
    if (user.role === 'USER') {
        if (ticket.requestedById !== user.id) {
            return { allowed: false, reason: 'Solo puedes modificar tus propios tickets' };
        }
        const allowedStates = ALLOWED_TRANSITIONS.USER[currentStatus] || [];
        if (allowedStates.includes(newStatus)) {
            return { allowed: true };
        }
        return { allowed: false, reason: `No puedes cambiar el estado del ticket. Solo puedes cerrar tickets resueltos.` };
    }
    // TECHNICIAN tiene los mismos permisos que ADMIN para cambiar estados
    if (user.role === 'TECHNICIAN') {
        // Técnico puede cambiar a cualquier estado permitido (mismo que ADMIN)
        const allowedStates = ALLOWED_TRANSITIONS.TECHNICIAN[currentStatus] || [];
        if (allowedStates.includes(newStatus)) {
            return { allowed: true };
        }
        return { allowed: false, reason: `No se puede cambiar de ${currentStatus} a ${newStatus}` };
    }
    // SUPERVISOR puede cambiar estados de tickets de su área
    if (user.role === 'SUPERVISOR') {
        const allowedStates = ALLOWED_TRANSITIONS.SUPERVISOR[currentStatus] || [];
        if (allowedStates.includes(newStatus)) {
            return { allowed: true };
        }
        return { allowed: false, reason: `No se puede cambiar de ${currentStatus} a ${newStatus}` };
    }
    return { allowed: false, reason: 'Rol no reconocido' };
}
function getAvailableStatusTransitions(user, currentStatus, ticket) {
    if (!user)
        return [];
    // ADMIN puede cambiar a cualquier estado
    if (user.role === 'ADMIN') {
        return ALLOWED_TRANSITIONS.ADMIN[currentStatus] || [];
    }
    if (user.role === 'AUDITOR')
        return [];
    if (user.role === 'TECHNICIAN') {
        // Técnico tiene acceso completo a todas las transiciones permitidas (igual que ADMIN)
        return ALLOWED_TRANSITIONS.TECHNICIAN[currentStatus] || [];
    }
    if (user.role === 'USER') {
        if (ticket.requestedById !== user.id) {
            return [];
        }
        return ALLOWED_TRANSITIONS.USER[currentStatus] || [];
    }
    if (user.role === 'SUPERVISOR') {
        return ALLOWED_TRANSITIONS.SUPERVISOR[currentStatus] || [];
    }
    return [];
}
exports.statusLabels = {
    OPEN: 'Nuevo',
    ASSIGNED: 'Asignado',
    IN_PROGRESS: 'En Progreso',
    PENDING: 'En Espera',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
    CANCELLED: 'Rechazado',
};
