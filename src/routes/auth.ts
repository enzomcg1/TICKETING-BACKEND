import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { loggerService } from '../services/loggerService';
import { getJwtSecret } from '../config/security';
import { clearLoginRateLimit, loginRateLimit } from '../middleware/security';

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register - Registrar nuevo usuario (solo ADMIN)
router.post('/register', authenticate, async (req: any, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });
    }

    const { email, password, name, role, departmentId, branchId } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Email invalido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya esta registrado' });
    }

    const validRoles = ['ADMIN', 'TECHNICIAN', 'USER', 'SUPERVISOR', 'AUDITOR'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol invalido' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        password: hashedPassword,
        name,
        role,
        departmentId: departmentId || null,
        branchId: branchId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        createdAt: true,
      }
    });

    const requestInfo = loggerService.extractRequestInfo(req);
    loggerService.info(
      `Usuario creado: ${user.name} (${user.email}) con rol ${user.role}`,
      'USER',
      {
        userId: req.user?.id,
        metadata: {
          createdUserId: user.id,
          createdUserEmail: user.email,
          createdUserName: user.name,
          createdUserRole: user.role,
        },
        ...requestInfo,
      }
    ).catch((err) => console.error('Error al registrar log de creacion de usuario:', err));

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST /api/auth/login - Iniciar sesion
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Usuario/Email y contrasena son requeridos' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email invalido' });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        isActive: true,
        department: {
          select: { id: true, name: true, code: true }
        },
        branch: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      } as jwt.SignOptions
    );

    clearLoginRateLimit(req);

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department || null,
        branch: user.branch || null,
      }
    });
  } catch (error: any) {
    console.error('Error al iniciar sesion:', error);
    res.status(500).json({
      error: 'Error al iniciar sesion',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/auth/me - Obtener informacion del usuario actual
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        branchId: true,
        department: {
          select: { id: true, name: true, code: true }
        },
        branch: {
          select: { id: true, name: true, code: true }
        },
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// PUT /api/auth/change-password - Cambiar contrasena propia
router.put('/change-password', authenticate, async (req: any, res) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'La contrasena actual y la nueva contrasena son requeridas' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' });
    }

    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
      }
    });

    if (!userWithPassword) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'La contrasena actual es incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      }
    });

    res.json({ message: 'Contrasena actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contrasena:', error);
    res.status(500).json({ error: 'Error al cambiar contrasena' });
  }
});

export default router;
