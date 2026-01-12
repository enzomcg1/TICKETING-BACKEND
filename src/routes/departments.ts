import express from 'express';
import prisma from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/departments - Listar departamentos (público para registro)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { branchId } = req.query;
    
    let where: any = { isActive: true };
    
    // Si se especifica branchId, filtrar por sucursal
    if (branchId) {
      where.branchId = branchId as string;
    }
    
    // Si hay usuario autenticado, aplicar restricciones de rol
    if (req.user) {
      const user = req.user;
      // SUPERVISOR solo ve departamentos de su sucursal
      if (user.role === 'SUPERVISOR' && user.branchId) {
        where.branchId = user.branchId;
      }
    }
    
    const departments = await prisma.department.findMany({
      where,
      include: {
        branch: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(departments);
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    res.status(500).json({ error: 'Error al obtener departamentos' });
  }
});

// POST /api/departments - Crear departamento (solo administrador)
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, code, description, branchId } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: 'Nombre y código son requeridos' });
    }

    // Verificar que no exista el mismo código en la misma sucursal
    const existingDept = await prisma.department.findFirst({
      where: {
        code,
        branchId: branchId || null
      }
    });

    if (existingDept) {
      return res.status(400).json({ error: 'Ya existe un departamento con ese código en esta sucursal' });
    }
    
    const department = await prisma.department.create({
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
  } catch (error) {
    console.error('Error al crear departamento:', error);
    res.status(500).json({ error: 'Error al crear departamento' });
  }
});

// PUT /api/departments/:id - Actualizar departamento (solo administrador)
router.put('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, branchId, isActive } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (branchId !== undefined) updateData.branchId = branchId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        branch: true
      }
    });

    res.json(department);
  } catch (error) {
    console.error('Error al actualizar departamento:', error);
    res.status(500).json({ error: 'Error al actualizar departamento' });
  }
});

export default router;
