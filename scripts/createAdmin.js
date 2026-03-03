const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('Creando usuario administrador...');

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.error('Debes definir ADMIN_EMAIL y ADMIN_PASSWORD en variables de entorno.');
      process.exit(1);
    }

    if (password.length < 12) {
      console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('El usuario admin ya existe');
      console.log(`Email: ${existingUser.email}`);
      console.log(`Rol: ${existingUser.role}`);
      return;
    }

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('Usuario administrador creado exitosamente');
    console.log(`ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Nombre: ${admin.name}`);
    console.log(`Rol: ${admin.role}`);
  } catch (error) {
    console.error('Error al crear usuario administrador:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
