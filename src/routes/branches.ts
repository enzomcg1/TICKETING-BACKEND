import express from 'express';
import prisma from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/branches - Listar todas las sucursales (público para registro)
router.get('/', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(branches);
  } catch (error) {
    console.error('Error al obtener sucursales:', error);
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});

// POST /api/branches - Crear sucursal (solo administrador)
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { code, name, address, city, state } = req.body;
    
    if (!code || !name || !address || !city || !state) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar que el código no exista
    const existingBranch = await prisma.branch.findUnique({
      where: { code }
    });

    if (existingBranch) {
      return res.status(400).json({ error: 'El código de sucursal ya existe' });
    }

    const branch = await prisma.branch.create({
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
  } catch (error) {
    console.error('Error al crear sucursal:', error);
    res.status(500).json({ error: 'Error al crear sucursal' });
  }
});

// PUT /api/branches/:id - Actualizar sucursal (solo administrador)
router.put('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { code, name, address, city, state, isActive } = req.body;

    const updateData: any = {};
    if (code) updateData.code = code;
    if (name) updateData.name = name;
    if (address) updateData.address = address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (isActive !== undefined) updateData.isActive = isActive;

    const branch = await prisma.branch.update({
      where: { id },
      data: updateData
    });

    res.json(branch);
  } catch (error) {
    console.error('Error al actualizar sucursal:', error);
    res.status(500).json({ error: 'Error al actualizar sucursal' });
  }
});

export default router;
