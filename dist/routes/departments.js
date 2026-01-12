"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /api/departments - Listar departamentos
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { branchId } = req.query;
        const user = req.user;
        let where = { isActive: true };
        // Si se especifica branchId, filtrar por sucursal
        if (branchId) {
            where.branchId = branchId;
        }
        // SUPERVISOR solo ve departamentos de su sucursal
        if (user.role === 'SUPERVISOR' && user.branchId) {
            where.branchId = user.branchId;
        }
        const departments = await database_1.default.department.findMany({
            where,
            include: {
                branch: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(departments);
    }
    catch (error) {
        console.error('Error al obtener departamentos:', error);
        res.status(500).json({ error: 'Error al obtener departamentos' });
    }
});
// POST /api/departments - Crear departamento (solo administrador)
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { name, code, description, branchId } = req.body;
        if (!name || !code) {
            return res.status(400).json({ error: 'Nombre y código son requeridos' });
        }
        // Verificar que no exista el mismo código en la misma sucursal
        const existingDept = await database_1.default.department.findFirst({
            where: {
                code,
                branchId: branchId || null
            }
        });
        if (existingDept) {
            return res.status(400).json({ error: 'Ya existe un departamento con ese código en esta sucursal' });
        }
        const department = await database_1.default.department.create({
            data: {
                name,
                code,
                description,
                branchId: branchId || null,
                isActive: true
            },
            include: {
                branch: true
            }
        });
        res.status(201).json(department);
    }
    catch (error) {
        console.error('Error al crear departamento:', error);
        res.status(500).json({ error: 'Error al crear departamento' });
    }
});
// PUT /api/departments/:id - Actualizar departamento (solo administrador)
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, branchId, isActive } = req.body;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (code)
            updateData.code = code;
        if (description !== undefined)
            updateData.description = description;
        if (branchId !== undefined)
            updateData.branchId = branchId;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const department = await database_1.default.department.update({
            where: { id },
            data: updateData,
            include: {
                branch: true
            }
        });
        res.json(department);
    }
    catch (error) {
        console.error('Error al actualizar departamento:', error);
        res.status(500).json({ error: 'Error al actualizar departamento' });
    }
});
exports.default = router;
