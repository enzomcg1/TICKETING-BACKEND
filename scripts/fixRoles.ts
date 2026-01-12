import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function fixRoles() {
  try {
    console.log('🔧 Actualizando roles de usuarios en la base de datos...\n');

    // Primero, verificar qué roles existen actualmente usando una consulta SQL directa
    // Pero como Prisma no puede hacer esto fácilmente, vamos a intentar actualizar directamente
    
    // Intentar leer los usuarios con raw SQL primero para ver qué roles tienen
    const rawUsers = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, email, name, role, "isActive"
      FROM users
      LIMIT 10
    `);

    console.log('Usuarios encontrados en la base de datos:');
    rawUsers.forEach((user: any) => {
      console.log(`  - ${user.name} (${user.email}): rol actual = "${user.role}"`);
    });

    // Mapeo de roles antiguos a nuevos
    const roleMapping: Record<string, string> = {
      'administrador': 'ADMIN',
      'tecnico': 'TECHNICIAN',
      'usuario': 'USER',
      'supervisor': 'SUPERVISOR',
      'auditor': 'AUDITOR',
    };

    // Actualizar roles usando raw SQL
    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE users
        SET role = $1::text
        WHERE role = $2::text
      `, newRole, oldRole);
      
      if (result > 0) {
        console.log(`✅ Actualizados ${result} usuario(s) de "${oldRole}" a "${newRole}"`);
      }
    }

    // Actualizar roles en user_requests también
    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE user_requests
        SET "requestedRole" = $1::text
        WHERE "requestedRole" = $2::text
      `, newRole, oldRole);
      
      if (result > 0) {
        console.log(`✅ Actualizadas ${result} solicitud(es) de "${oldRole}" a "${newRole}"`);
      }
    }

    console.log('\n✅ Actualización de roles completada.\n');

    // Verificar usuarios después de la actualización
    const updatedUsers = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, email, name, role, "isActive"
      FROM users
      ORDER BY "createdAt" ASC
    `);

    console.log('Usuarios después de la actualización:');
    updatedUsers.forEach((user: any) => {
      console.log(`  - ${user.name} (${user.email}): ${user.role}, Activo: ${user.isActive}`);
    });

  } catch (error: any) {
    console.error('❌ Error al actualizar roles:', error.message);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixRoles();






