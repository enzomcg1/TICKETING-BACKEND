"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /api/branches - Listar todas las sucursales (todos pueden ver)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const branches = await database_1.default.branch.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    }
    catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});
// POST /api/branches - Crear sucursal (solo administrador)
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { code, name, address, city, state } = req.body;
        if (!code || !name || !address || !city || !state) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        // Verificar que el código no exista
        const existingBranch = await database_1.default.branch.findUnique({
            where: { code }
        });
        if (existingBranch) {
            return res.status(400).json({ error: 'El código de sucursal ya existe' });
        }
        const branch = await database_1.default.branch.create({
            data: {
                code,
                name,
                address,
                city,
                state,
                isActive: true
            }
        });
        res.status(201).json(branch);
    }
    catch (error) {
        console.error('Error al crear sucursal:', error);
        res.status(500).json({ error: 'Error al crear sucursal' });
    }
});
// PUT /api/branches/:id - Actualizar sucursal (solo administrador)
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, address, city, state, isActive } = req.body;
        const updateData = {};
        if (code)
            updateData.code = code;
        if (name)
            updateData.name = name;
        if (address)
            updateData.address = address;
        if (city)
            updateData.city = city;
        if (state)
            updateData.state = state;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const branch = await database_1.default.branch.update({
            where: { id },
            data: updateData
        });
        res.json(branch);
    }
    catch (error) {
        console.error('Error al actualizar sucursal:', error);
        res.status(500).json({ error: 'Error al actualizar sucursal' });
    }
});
exports.default = router;
