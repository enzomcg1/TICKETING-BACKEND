"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const loggerService_1 = require("../services/loggerService");
const router = express_1.default.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// POST /api/user-requests - Crear solicitud de registro (público, no requiere auth)
router.post('/', async (req, res) => {
    try {
        const { name, email, password, requestedRole, departmentId, branchId } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        // Validar campos requeridos
        if (!name || !normalizedEmail || !password || !requestedRole) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }
        // Validar que el email no exista en usuarios
        const existingUser = await database_1.default.user.findUnique({
            where: { email: normalizedEmail }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        // Validar que el email no tenga una solicitud pendiente
        const existingRequest = await database_1.default.userRequest.findUnique({
            where: { email: normalizedEmail }
        });
        if (existingRequest && existingRequest.status === 'PENDING') {
            return res.status(400).json({ error: 'Ya existe una solicitud pendiente con este email' });
        }
        // Validar que el rol sea válido (no permitir ADMIN)
        const validRoles = ['TECHNICIAN', 'USER', 'SUPERVISOR', 'AUDITOR'];
        if (!validRoles.includes(requestedRole)) {
            return res.status(400).json({ error: 'Rol inválido para solicitud' });
        }
        // Hash de la contraseña
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Crear solicitud
        const userRequest = await database_1.default.userRequest.create({
            data: {
                name,
                email: normalizedEmail,
                password: hashedPassword,
                requestedRole,
                departmentId: departmentId || null,
                branchId: branchId || null,
                status: 'PENDING'
            },
            include: {
                department: {
                    select: { id: true, name: true, code: true }
                },
                branch: {
                    select: { id: true, name: true, code: true }
                }
            }
        });
        // TODO: Enviar notificación a administradores (Socket.IO, Email, WhatsApp)
        // emitNotificationToAdmins(userRequest);
        res.status(201).json({
            message: 'Solicitud de registro creada exitosamente. Un administrador revisará tu solicitud.',
            request: {
                id: userRequest.id,
                email: userRequest.email,
                status: userRequest.status
            }
        });
    }
    catch (error) {
        console.error('Error al crear solicitud de registro:', error);
        res.status(500).json({ error: 'Error al crear solicitud de registro' });
    }
});
// GET /api/user-requests - Listar todas las solicitudes (solo administrador)
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) {
            where.status = status;
        }
        const requests = await database_1.default.userRequest.findMany({
            where,
            include: {
                department: {
                    select: { id: true, name: true, code: true }
                },
                branch: {
                    select: { id: true, name: true, code: true }
                },
                processedBy: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    }
    catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
});
// GET /api/user-requests/:id - Obtener una solicitud específica (solo administrador)
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const request = await database_1.default.userRequest.findUnique({
            where: { id: req.params.id },
            include: {
                department: {
                    select: { id: true, name: true, code: true }
                },
                branch: {
                    select: { id: true, name: true, code: true }
                },
                processedBy: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
        if (!request) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        res.json(request);
    }
    catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({ error: 'Error al obtener solicitud' });
    }
});
// POST /api/user-requests/:id/approve - Aprobar solicitud (solo administrador)
router.post('/:id/approve', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const userRequest = await database_1.default.userRequest.findUnique({
            where: { id }
        });
        if (!userRequest) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        if (userRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'La solicitud ya fue procesada' });
        }
        // Verificar que el email no exista (doble verificación)
        const existingUser = await database_1.default.user.findUnique({
            where: { email: userRequest.email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Ya existe un usuario con este email' });
        }
        // Crear el usuario
        const newUser = await database_1.default.user.create({
            data: {
                email: userRequest.email,
                password: userRequest.password, // Ya está hasheado
                name: userRequest.name,
                role: userRequest.requestedRole,
                departmentId: userRequest.departmentId,
                branchId: userRequest.branchId,
                isActive: true
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                departmentId: true,
                branchId: true,
                createdAt: true
            }
        });
        // Actualizar la solicitud como aprobada
        await database_1.default.userRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                processedById: user.id,
                processedAt: new Date()
            }
        });
        // Registrar evento en el historial
        const requestInfo = loggerService_1.loggerService.extractRequestInfo(req);
        loggerService_1.loggerService.info(`Solicitud de registro aprobada y usuario creado: ${newUser.name} (${newUser.email}) con rol ${newUser.role}`, 'USER', {
            userId: user.id,
            metadata: {
                requestId: id,
                createdUserId: newUser.id,
                createdUserEmail: newUser.email,
                createdUserName: newUser.name,
                createdUserRole: newUser.role,
            },
            ...requestInfo,
        }).catch(err => console.error('Error al registrar log de aprobación de solicitud:', err));
        // TODO: Enviar email al nuevo usuario con credenciales
        // sendWelcomeEmail(newUser.email, userRequest.email);
        res.json({
            message: 'Solicitud aprobada y usuario creado exitosamente',
            user: newUser
        });
    }
    catch (error) {
        console.error('Error al aprobar solicitud:', error);
        res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
});
// POST /api/user-requests/:id/reject - Rechazar solicitud (solo administrador)
router.post('/:id/reject', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const userRequest = await database_1.default.userRequest.findUnique({
            where: { id }
        });
        if (!userRequest) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        if (userRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'La solicitud ya fue procesada' });
        }
        // Actualizar la solicitud como rechazada
        await database_1.default.userRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                processedById: user.id,
                processedAt: new Date(),
                rejectionReason: rejectionReason || null
            }
        });
        // Registrar evento en el historial
        const requestInfo = loggerService_1.loggerService.extractRequestInfo(req);
        loggerService_1.loggerService.info(`Solicitud de registro rechazada: ${userRequest.name} (${userRequest.email}) con rol solicitado ${userRequest.requestedRole}${rejectionReason ? `. Motivo: ${rejectionReason}` : ''}`, 'USER', {
            userId: user.id,
            metadata: {
                requestId: id,
                requestEmail: userRequest.email,
                requestName: userRequest.name,
                requestedRole: userRequest.requestedRole,
                rejectionReason: rejectionReason || null,
            },
            ...requestInfo,
        }).catch(err => console.error('Error al registrar log de rechazo de solicitud:', err));
        // TODO: Enviar email al solicitante informando el rechazo
        // sendRejectionEmail(userRequest.email, rejectionReason);
        res.json({
            message: 'Solicitud rechazada exitosamente'
        });
    }
    catch (error) {
        console.error('Error al rechazar solicitud:', error);
        res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
});
exports.default = router;
