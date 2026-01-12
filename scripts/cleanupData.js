const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupData() {
  try {
    console.log('🧹 Iniciando limpieza de datos...\n');

    // Contar registros antes de eliminar
    const ticketsCount = await prisma.ticket.count();
    const usersCount = await prisma.user.count();
    const commentsCount = await prisma.comment.count();
    const notificationsCount = await prisma.notification.count();
    const attachmentsCount = await prisma.attachment.count();
    const ticketHistoryCount = await prisma.ticketHistory.count();

    console.log('📊 Registros actuales:');
    console.log(`   🎫 Tickets: ${ticketsCount}`);
    console.log(`   👥 Usuarios: ${usersCount}`);
    console.log(`   💬 Comentarios: ${commentsCount}`);
    console.log(`   🔔 Notificaciones: ${notificationsCount}`);
    console.log(`   📎 Adjuntos: ${attachmentsCount}`);
    console.log(`   📜 Historial de tickets: ${ticketHistoryCount}\n`);

    // Confirmar eliminación
    console.log('⚠️  ADVERTENCIA: Se eliminarán todos los datos excepto sucursales y departamentos.');
    console.log('   Esto incluye:');
    console.log('   - Todos los tickets');
    console.log('   - Todos los usuarios (excepto admin si existe)');
    console.log('   - Todos los comentarios');
    console.log('   - Todas las notificaciones');
    console.log('   - Todos los adjuntos');
    console.log('   - Todo el historial de tickets\n');

    // 1. Eliminar tickets (esto eliminará automáticamente comentarios, adjuntos, notificaciones, historial por cascada)
    console.log('🗑️  Eliminando tickets y datos relacionados...');
    const deletedTickets = await prisma.ticket.deleteMany({});
    console.log(`   ✅ ${deletedTickets.count} tickets eliminados`);

    // 2. Eliminar notificaciones restantes (por si acaso)
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`   ✅ ${deletedNotifications.count} notificaciones eliminadas`);

    // 3. Eliminar comentarios restantes (por si acaso)
    const deletedComments = await prisma.comment.deleteMany({});
    console.log(`   ✅ ${deletedComments.count} comentarios eliminados`);

    // 4. Eliminar adjuntos restantes (por si acaso)
    const deletedAttachments = await prisma.attachment.deleteMany({});
    console.log(`   ✅ ${deletedAttachments.count} adjuntos eliminados`);

    // 5. Eliminar historial de tickets restante (por si acaso)
    const deletedHistory = await prisma.ticketHistory.deleteMany({});
    console.log(`   ✅ ${deletedHistory.count} registros de historial eliminados`);

    // 6. Eliminar solicitudes de registro pendientes
    const deletedRegRequests = await prisma.userRequest.deleteMany({});
    console.log(`   ✅ ${deletedRegRequests.count} solicitudes de registro eliminadas`);

    // 7. Eliminar usuarios (excepto admin si existe)
    console.log('\n👥 Eliminando usuarios...');
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@admin.com' },
          { email: 'admin' },
          { role: 'ADMIN' }
        ]
      }
    });

    if (adminUser) {
      // Eliminar todos los usuarios excepto el admin
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: { not: adminUser.id }
        }
      });
      console.log(`   ✅ ${deletedUsers.count} usuarios eliminados`);
      console.log(`   ⚠️  Usuario admin conservado: ${adminUser.email} (${adminUser.name})`);
    } else {
      // Eliminar todos los usuarios
      const deletedUsers = await prisma.user.deleteMany({});
      console.log(`   ✅ ${deletedUsers.count} usuarios eliminados`);
      console.log(`   ⚠️  No se encontró usuario admin para conservar`);
    }

    // 8. Eliminar logs del sistema (opcional, comentado por si quieres conservarlos)
    // const deletedLogs = await prisma.systemLog.deleteMany({});
    // console.log(`   ✅ ${deletedLogs.count} logs eliminados`);

    // Verificar registros restantes
    const remainingTickets = await prisma.ticket.count();
    const remainingUsers = await prisma.user.count();
    const remainingComments = await prisma.comment.count();
    const remainingNotifications = await prisma.notification.count();
    const remainingAttachments = await prisma.attachment.count();

    console.log('\n✨ Limpieza completada!');
    console.log('\n📊 Registros restantes:');
    console.log(`   🎫 Tickets: ${remainingTickets}`);
    console.log(`   👥 Usuarios: ${remainingUsers}`);
    console.log(`   💬 Comentarios: ${remainingComments}`);
    console.log(`   🔔 Notificaciones: ${remainingNotifications}`);
    console.log(`   📎 Adjuntos: ${remainingAttachments}`);

    // Mostrar usuarios restantes
    if (remainingUsers > 0) {
      const remainingUsersList = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true }
      });
      console.log('\n👥 Usuarios restantes:');
      remainingUsersList.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
      });
    }

    console.log('\n💡 Los datos han sido eliminados. Puedes empezar a cargar usuarios y tickets nuevos.');
    console.log('   ✅ Sucursales y departamentos se mantienen intactos.');

  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupData()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

