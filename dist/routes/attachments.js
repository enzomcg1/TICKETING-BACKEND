"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const storageFactory_1 = require("../services/storage/storageFactory");
const loggerService_1 = require("../services/loggerService");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const router = express_1.default.Router();
const storageService = (0, storageFactory_1.getStorageService)();
// POST /api/attachments/tickets/:ticketId - Subir adjuntos a un ticket
router.post('/tickets/:ticketId', auth_1.authenticate, upload_1.upload.array('files', 5), async (req, res) => {
    try {
        const user = req.user;
        const { ticketId } = req.params;
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron archivos' });
        }
        // Verificar que el ticket existe y el usuario tiene permisos
        const ticket = await database_1.default.ticket.findUnique({
            where: { id: ticketId },
            include: {
                requestedBy: true,
                assignedTo: true,
            },
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }
        // Verificar permisos: el usuario puede subir adjuntos si:
        // - Es el creador del ticket
        // - Es el técnico asignado
        // - Es admin o supervisor
        const canUpload = user.role === 'ADMIN' ||
            user.role === 'SUPERVISOR' ||
            ticket.requestedById === user.id ||
            ticket.assignedToId === user.id;
        if (!canUpload) {
            await loggerService_1.loggerService.warn('Intento de subir adjuntos sin permisos', 'TICKET', {
                userId: user.id,
                ticketId: ticketId
            });
            return res.status(403).json({ error: 'No tienes permisos para subir adjuntos a este ticket' });
        }
        const uploadedAttachments = [];
        // Subir cada archivo
        for (const file of files) {
            try {
                const fileName = (0, upload_1.generateFileName)(file.originalname);
                const folder = `tickets/${ticketId}`;
                // Subir archivo usando el servicio de almacenamiento
                const { url, path: filePath } = await storageService.uploadFile(file.buffer, fileName, folder);
                // Guardar información en la base de datos
                const attachment = await database_1.default.attachment.create({
                    data: {
                        fileName,
                        originalName: file.originalname,
                        filePath,
                        fileUrl: url,
                        fileSize: file.size,
                        mimeType: file.mimetype,
                        ticketId,
                        uploadedById: user.id,
                    },
                    include: {
                        uploadedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                });
                uploadedAttachments.push(attachment);
            }
            catch (error) {
                console.error(`Error al subir archivo ${file.originalname}:`, error);
                console.error('Error detallado:', error.message);
                console.error('Stack:', error.stack);
                // Continuar con los demás archivos
            }
        }
        if (uploadedAttachments.length === 0) {
            return res.status(500).json({
                error: 'No se pudo subir ningún archivo',
                details: 'Verifica que la tabla attachments existe en la base de datos y que tienes permisos de escritura en la carpeta uploads'
            });
        }
        await loggerService_1.loggerService.info(`Se subieron ${uploadedAttachments.length} archivo(s) al ticket`, 'TICKET', {
            userId: user.id,
            ticketId: ticketId
        });
        res.status(201).json({
            message: 'Archivos subidos exitosamente',
            attachments: uploadedAttachments,
        });
    }
    catch (error) {
        console.error('Error al subir adjuntos:', error);
        console.error('Error detallado:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            error: 'Error al subir adjuntos',
            details: error.message || 'Error desconocido',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
// GET /api/attachments/tickets/:ticketId - Obtener todos los adjuntos de un ticket
router.get('/tickets/:ticketId', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { ticketId } = req.params;
        // Verificar que el ticket existe y el usuario tiene permisos para verlo
        const ticket = await database_1.default.ticket.findUnique({
            where: { id: ticketId },
            include: {
                requestedBy: true,
                assignedTo: true,
            },
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }
        // Verificar permisos de visualización (misma lógica que ver ticket)
        const canView = user.role === 'ADMIN' ||
            user.role === 'AUDITOR' ||
            user.role === 'SUPERVISOR' ||
            ticket.requestedById === user.id ||
            ticket.assignedToId === user.id;
        if (!canView) {
            return res.status(403).json({ error: 'No tienes permisos para ver este ticket' });
        }
        // Obtener adjuntos
        const attachments = await database_1.default.attachment.findMany({
            where: {
                ticketId,
                commentId: null, // Solo adjuntos del ticket, no de comentarios
            },
            include: {
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.json(attachments);
    }
    catch (error) {
        console.error('Error al obtener adjuntos:', error);
        res.status(500).json({ error: 'Error al obtener adjuntos' });
    }
});
// GET /api/attachments/:id/download - Descargar un adjunto
router.get('/:id/download', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        // Obtener información del adjunto
        const attachment = await database_1.default.attachment.findUnique({
            where: { id },
            include: {
                ticket: {
                    include: {
                        requestedBy: true,
                        assignedTo: true,
                    },
                },
            },
        });
        if (!attachment) {
            return res.status(404).json({ error: 'Adjunto no encontrado' });
        }
        // Verificar permisos de visualización
        const ticket = attachment.ticket;
        const canView = user.role === 'ADMIN' ||
            user.role === 'AUDITOR' ||
            user.role === 'SUPERVISOR' ||
            ticket.requestedById === user.id ||
            ticket.assignedToId === user.id;
        if (!canView) {
            return res.status(403).json({ error: 'No tienes permisos para descargar este archivo' });
        }
        // Obtener la ruta completa del archivo
        const filePath = path_1.default.join(process.cwd(), 'uploads', attachment.filePath);
        // Verificar que el archivo existe
        try {
            await promises_1.default.access(filePath);
        }
        catch {
            return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
        }
        // Enviar el archivo
        res.download(filePath, attachment.originalName, (err) => {
            if (err) {
                console.error('Error al descargar archivo:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error al descargar archivo' });
                }
            }
        });
    }
    catch (error) {
        console.error('Error al descargar adjunto:', error);
        res.status(500).json({ error: 'Error al descargar adjunto' });
    }
});
// DELETE /api/attachments/:id - Eliminar un adjunto
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        // Obtener información del adjunto
        const attachment = await database_1.default.attachment.findUnique({
            where: { id },
            include: {
                ticket: {
                    include: {
                        requestedBy: true,
                        assignedTo: true,
                    },
                },
                uploadedBy: true,
            },
        });
        if (!attachment) {
            return res.status(404).json({ error: 'Adjunto no encontrado' });
        }
        // Verificar permisos: solo el que subió el archivo o admin pueden eliminarlo
        const canDelete = user.role === 'ADMIN' ||
            attachment.uploadedById === user.id;
        if (!canDelete) {
            await loggerService_1.loggerService.warn('Intento de eliminar adjunto sin permisos', 'TICKET', {
                userId: user.id,
                ticketId: attachment.ticketId
            });
            return res.status(403).json({ error: 'No tienes permisos para eliminar este archivo' });
        }
        // Eliminar archivo del almacenamiento
        try {
            await storageService.deleteFile(attachment.filePath);
        }
        catch (error) {
            console.error('Error al eliminar archivo del almacenamiento:', error);
            // Continuar aunque falle (el archivo puede no existir)
        }
        // Eliminar registro de la base de datos
        await database_1.default.attachment.delete({
            where: { id },
        });
        await loggerService_1.loggerService.info(`Adjunto eliminado: ${attachment.originalName}`, 'TICKET', {
            userId: user.id,
            ticketId: attachment.ticketId
        });
        res.json({ message: 'Adjunto eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar adjunto:', error);
        res.status(500).json({ error: 'Error al eliminar adjunto' });
    }
});
exports.default = router;
