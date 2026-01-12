import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { loggerService } from '../services/loggerService';

const router = express.Router();

// POST /api/auth/register - Registrar nuevo usuario (solo ADMIN)
router.post('/register', authenticate, async (req: any, res) => {
  try {
    // Verificar que el usuario autenticado es ADMIN
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });
    }

    const { email, password, name, role, departmentId, branchId } = req.body;

    // Validar campos requeridos
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar que el email no exista
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Validar que el rol sea válido
    const validRoles = ['ADMIN', 'TECHNICIAN', 'USER', 'SUPERVISOR', 'AUDITOR'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
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

    // Registrar evento en el historial
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
    ).catch(err => console.error('Error al registrar log de creación de usuario:', err));

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN] Solicitud de login recibida');
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('[LOGIN] Campos faltantes');
      return res.status(400).json({ error: 'Usuario/Email y contraseña son requeridos' });
    }

    console.log(`[LOGIN] Buscando usuario con email: ${email.trim()}`);

    // Buscar usuario por email (puede ser username o email)
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: email.trim() },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          departmentId: true,
          branchId: true,
          department: {
            select: { id: true, name: true, code: true }
          },
          branch: {
            select: { id: true, name: true, code: true }
          }
        }
      });
      console.log(`[LOGIN] Usuario encontrado: ${user ? user.name : 'No encontrado'}`);
    } catch (dbError: any) {
      console.error('[LOGIN] Error al buscar usuario en BD:', dbError.message);
      console.error('[LOGIN] Código de error:', dbError.code);
      throw dbError;
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const jwtSecret = process.env.JWT_SECRET || 'ticketing_system_secret_key_2024_change_in_production';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: expiresIn,
      } as jwt.SignOptions
    );

    // Retornar información del usuario y token (sin password)
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
    console.error('Error al iniciar sesión:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Error al iniciar sesión',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/auth/me - Obtener información del usuario actual
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

// PUT /api/auth/change-password - Cambiar contraseña propia
router.put('/change-password', authenticate, async (req: any, res) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'La contraseña actual y la nueva contraseña son requeridas' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Obtener el usuario con la contraseña
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

    // Verificar la contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      }
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

export default router;

