import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Verificando estado de la base de datos...\n');

    // Verificar usuarios y sus roles
    console.log('📊 USUARIOS:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
        departmentId: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Total de usuarios: ${users.length}`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email})`);
      console.log(`     Rol: ${user.role}`);
      console.log(`     Activo: ${user.isActive}`);
      console.log(`     BranchId: ${user.branchId || 'N/A'}`);
      console.log(`     DepartmentId: ${user.departmentId || 'N/A'}`);
      console.log('');
    });

    // Verificar roles únicos
    const uniqueRoles = [...new Set(users.map(u => u.role))];
    console.log(`\n📋 Roles encontrados en la base de datos: ${uniqueRoles.join(', ')}`);
    console.log(`📋 Roles esperados por el código: ADMIN, TECHNICIAN, USER, SUPERVISOR, AUDITOR`);

    // Verificar tickets
    console.log('\n📊 TICKETS:');
    const ticketCount = await prisma.ticket.count();
    console.log(`Total de tickets: ${ticketCount}`);

    if (ticketCount > 0) {
      const sampleTickets = await prisma.ticket.findMany({
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          requestedById: true,
          assignedToId: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log('\nÚltimos 5 tickets:');
      sampleTickets.forEach((ticket, index) => {
        console.log(`  ${index + 1}. ${ticket.title}`);
        console.log(`     Estado: ${ticket.status}`);
        console.log(`     RequestedBy: ${ticket.requestedById}`);
        console.log(`     AssignedTo: ${ticket.assignedToId || 'Sin asignar'}`);
        console.log('');
      });
    }

    // Verificar sucursales
    console.log('\n📊 SUCURSALES:');
    const branchCount = await prisma.branch.count();
    console.log(`Total de sucursales: ${branchCount}`);

    // Verificar departamentos
    console.log('\n📊 DEPARTAMENTOS:');
    const deptCount = await prisma.department.count();
    console.log(`Total de departamentos: ${deptCount}`);

    // Verificar solicitudes de registro
    console.log('\n📊 SOLICITUDES DE REGISTRO:');
    const requestCount = await prisma.userRequest.count();
    console.log(`Total de solicitudes: ${requestCount}`);

    // Verificar si hay roles inconsistentes
    const validRoles = ['ADMIN', 'TECHNICIAN', 'USER', 'SUPERVISOR', 'AUDITOR'];
    const invalidRoles = uniqueRoles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      console.log('\n⚠️  ADVERTENCIA: Se encontraron roles que no coinciden con el código:');
      invalidRoles.forEach(role => {
        const usersWithRole = users.filter(u => u.role === role);
        console.log(`  - ${role}: ${usersWithRole.length} usuario(s)`);
        usersWithRole.forEach(u => {
          console.log(`    • ${u.name} (${u.email})`);
        });
      });
      console.log('\n❌ Estos roles deben actualizarse manualmente en la base de datos.');
    } else {
      console.log('\n✅ Todos los roles son válidos y coinciden con el código.');
    }

  } catch (error: any) {
    console.error('❌ Error al verificar la base de datos:', error);
    console.error('Detalles:', error.message);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();






