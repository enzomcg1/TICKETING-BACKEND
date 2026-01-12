const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    console.log('🔍 Verificando usuario admin...\n');

    // Buscar usuario admin
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@admin.com' },
          { email: 'admin' },
          { role: 'ADMIN' }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (adminUser) {
      console.log('✅ Usuario admin encontrado:');
      console.log(`   📧 Email: ${adminUser.email}`);
      console.log(`   👤 Nombre: ${adminUser.name}`);
      console.log(`   🔑 Rol: ${adminUser.role}`);
      console.log(`   ✅ Activo: ${adminUser.isActive ? 'Sí' : 'No'}`);
      console.log(`   📅 Creado: ${adminUser.createdAt}`);
    } else {
      console.log('❌ No se encontró usuario admin');
      console.log('\n💡 Puedes crear uno usando el script: npm run create:admin');
    }

    // Mostrar todos los usuarios
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`\n📊 Total de usuarios en el sistema: ${allUsers.length}`);
    if (allUsers.length > 0) {
      console.log('\n👥 Lista de usuarios:');
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.isActive ? 'Activo' : 'Inactivo'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error al verificar admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

