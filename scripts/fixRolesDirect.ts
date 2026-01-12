import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRolesDirect() {
  try {
    console.log('🔧 Actualizando roles directamente en la base de datos...\n');

    // Paso 1: Cambiar el tipo de columna a TEXT temporalmente
    console.log('1. Cambiando tipo de columna role a TEXT...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role TYPE TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_requests ALTER COLUMN "requestedRole" TYPE TEXT;
    `);
    console.log('✅ Columnas cambiadas a TEXT\n');

    // Paso 2: Actualizar los valores de roles
    console.log('2. Actualizando valores de roles en usuarios...');
    const roleUpdates = [
      { old: 'administrador', new: 'ADMIN' },
      { old: 'tecnico', new: 'TECHNICIAN' },
      { old: 'usuario', new: 'USER' },
      { old: 'supervisor', new: 'SUPERVISOR' },
      { old: 'auditor', new: 'AUDITOR' },
    ];

    for (const { old, new: newRole } of roleUpdates) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE users SET role = $1 WHERE role = $2
      `, newRole, old);
      if (result > 0) {
        console.log(`   ✅ ${result} usuario(s) actualizado(s): "${old}" → "${newRole}"`);
      }
    }

    console.log('\n3. Actualizando valores de roles en solicitudes...');
    for (const { old, new: newRole } of roleUpdates) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE user_requests SET "requestedRole" = $1 WHERE "requestedRole" = $2
      `, newRole, old);
      if (result > 0) {
        console.log(`   ✅ ${result} solicitud(es) actualizada(s): "${old}" → "${newRole}"`);
      }
    }

    // Paso 3: Eliminar valor por defecto de las columnas
    console.log('\n4. Eliminando valores por defecto...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE user_requests ALTER COLUMN "requestedRole" DROP DEFAULT;`);
      console.log('✅ Valores por defecto eliminados');
    } catch (e: any) {
      console.log('⚠️  No se pudo eliminar valores por defecto (puede que no existan)');
    }

    // Paso 4: Eliminar el enum antiguo
    console.log('\n5. Eliminando enum antiguo...');
    try {
      await prisma.$executeRawUnsafe(`DROP TYPE "UserRole" CASCADE;`);
      console.log('✅ Enum antiguo eliminado');
    } catch (e: any) {
      if (e.message && (e.message.includes('no existe') || e.message.includes('does not exist'))) {
        console.log('⚠️  El enum ya no existe');
      } else {
        throw e;
      }
    }

    // Paso 5: Crear el nuevo enum con valores en inglés
    console.log('\n6. Creando nuevo enum con valores en inglés...');
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECHNICIAN', 'USER', 'SUPERVISOR', 'AUDITOR');
    `);
    console.log('✅ Nuevo enum creado');

    // Paso 6: Cambiar las columnas de vuelta al enum
    console.log('\n7. Cambiando columnas de vuelta al enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role TYPE "UserRole" USING role::"UserRole";
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_requests ALTER COLUMN "requestedRole" TYPE "UserRole" USING "requestedRole"::"UserRole";
    `);
    console.log('✅ Columnas cambiadas de vuelta al enum');

    // Paso 7: Restaurar valores por defecto
    console.log('\n8. Restaurando valores por defecto...');
    await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'USER'::"UserRole";`);
    console.log('✅ Valores por defecto restaurados\n');

    // Paso 8: Verificar resultados
    console.log('9. Verificando resultados...');
    const users = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, email, name, role, "isActive"
      FROM users
      ORDER BY "createdAt" ASC
    `);

    console.log(`\n📊 Total de usuarios: ${users.length}`);
    users.forEach((user: any) => {
      console.log(`   - ${user.name} (${user.email}): ${user.role}, Activo: ${user.isActive}`);
    });

    const uniqueRoles = [...new Set(users.map((u: any) => u.role))];
    console.log(`\n✅ Roles únicos en la base de datos: ${uniqueRoles.join(', ')}`);

    console.log('\n✅ ¡Actualización completada exitosamente!');
    console.log('   Ahora puedes regenerar el cliente de Prisma con: npx prisma generate');

  } catch (error: any) {
    console.error('\n❌ Error al actualizar roles:', error.message);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
    console.error('Detalles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRolesDirect();

