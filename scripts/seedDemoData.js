const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Función para generar número de ticket único
async function generateUniqueTicketNumber() {
  const min = 100000;
  const max = 999999;
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ticketNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    const existingTicket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      select: { id: true }
    });
    
    if (!existingTicket) {
      return ticketNumber;
    }
  }
  
  throw new Error('No se pudo generar un número de ticket único');
}

// Función para obtener fecha aleatoria en los últimos días
function getRandomDate(daysAgo) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime = Math.random() * (now.getTime() - pastDate.getTime()) + pastDate.getTime();
  return new Date(randomTime);
}

async function seedDemoData() {
  try {
    console.log('🌱 Iniciando carga de datos de demostración...\n');

    // Obtener datos existentes
    const branches = await prisma.branch.findMany({ where: { isActive: true } });
    if (branches.length === 0) {
      console.error('❌ No hay sucursales. Ejecuta primero seedData.js');
      process.exit(1);
    }

    const departments = await prisma.department.findMany({ where: { isActive: true } });
    if (departments.length === 0) {
      console.error('❌ No hay departamentos. Ejecuta primero seedData.js');
      process.exit(1);
    }

    // Agrupar departamentos por sucursal
    const departmentsByBranch = {};
    departments.forEach(dept => {
      const branchId = dept.branchId || 'null';
      if (!departmentsByBranch[branchId]) {
        departmentsByBranch[branchId] = [];
      }
      departmentsByBranch[branchId].push(dept);
    });

    const soporteTIDept = departments.find(d => d.code === 'SOPORTE_TI');

    // 1. Crear usuarios de diferentes roles
    console.log('👥 Creando usuarios...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      // Admin (ya existe, lo omitimos)
      // Técnicos
      {
        name: 'Carlos Mendoza',
        email: 'carlos.mendoza@supermercado.com',
        password: hashedPassword,
        role: 'TECHNICIAN',
        branchId: branches[0].id,
        departmentId: soporteTIDept?.id || departments[0].id,
      },
      {
        name: 'Ana Rodríguez',
        email: 'ana.rodriguez@supermercado.com',
        password: hashedPassword,
        role: 'TECHNICIAN',
        branchId: branches[1]?.id || branches[0].id,
        departmentId: soporteTIDept?.id || departments[0].id,
      },
      {
        name: 'Luis García',
        email: 'luis.garcia@supermercado.com',
        password: hashedPassword,
        role: 'TECHNICIAN',
        branchId: branches[0].id,
        departmentId: soporteTIDept?.id || departments[0].id,
      },
      // Usuarios solicitantes
      {
        name: 'María López',
        email: 'maria.lopez@supermercado.com',
        password: hashedPassword,
        role: 'USER',
        branchId: branches[0].id,
        departmentId: departmentsByBranch[branches[0].id]?.find(d => d.code === 'CAJA_ATENCION')?.id || departmentsByBranch[branches[0].id]?.[0]?.id || departments[0].id,
      },
      {
        name: 'Juan Pérez',
        email: 'juan.perez@supermercado.com',
        password: hashedPassword,
        role: 'USER',
        branchId: branches[0].id,
        departmentId: departmentsByBranch[branches[0].id]?.find(d => d.code === 'ALMACEN')?.id || departmentsByBranch[branches[0].id]?.[1]?.id || departments[0].id,
      },
      {
        name: 'Carmen Sánchez',
        email: 'carmen.sanchez@supermercado.com',
        password: hashedPassword,
        role: 'USER',
        branchId: branches[1]?.id || branches[0].id,
        departmentId: departmentsByBranch[branches[1]?.id || branches[0].id]?.find(d => d.code === 'REPOSICION')?.id || departmentsByBranch[branches[1]?.id || branches[0].id]?.[0]?.id || departments[0].id,
      },
      {
        name: 'Roberto Fernández',
        email: 'roberto.fernandez@supermercado.com',
        password: hashedPassword,
        role: 'USER',
        branchId: branches[2]?.id || branches[0].id,
        departmentId: departmentsByBranch[branches[2]?.id || branches[0].id]?.[0]?.id || departments[0].id,
      },
      {
        name: 'Laura Martínez',
        email: 'laura.martinez@supermercado.com',
        password: hashedPassword,
        role: 'USER',
        branchId: branches[0].id,
        departmentId: departmentsByBranch[branches[0].id]?.find(d => d.code === 'VENTAS')?.id || departmentsByBranch[branches[0].id]?.[2]?.id || departments[0].id,
      },
      // Supervisores
      {
        name: 'Pedro González',
        email: 'pedro.gonzalez@supermercado.com',
        password: hashedPassword,
        role: 'SUPERVISOR',
        branchId: branches[0].id,
        departmentId: departmentsByBranch[branches[0].id]?.[0]?.id || departments[0].id,
      },
      {
        name: 'Sofia Torres',
        email: 'sofia.torres@supermercado.com',
        password: hashedPassword,
        role: 'SUPERVISOR',
        branchId: branches[1]?.id || branches[0].id,
        departmentId: departmentsByBranch[branches[1]?.id || branches[0].id]?.[0]?.id || departments[0].id,
      },
      // Auditor
      {
        name: 'Miguel Herrera',
        email: 'miguel.herrera@supermercado.com',
        password: hashedPassword,
        role: 'AUDITOR',
        branchId: branches[0].id,
        departmentId: departmentsByBranch[branches[0].id]?.[0]?.id || departments[0].id,
      },
    ];

    const createdUsers = [];
    for (const userData of users) {
      const existing = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existing) {
        const user = await prisma.user.create({ data: userData });
        createdUsers.push(user);
        console.log(`  ✅ ${user.name} (${user.role})`);
      } else {
        console.log(`  ⚠️  ${userData.email} ya existe`);
        createdUsers.push(existing);
      }
    }

    const technicians = createdUsers.filter(u => u.role === 'TECHNICIAN');
    const regularUsers = createdUsers.filter(u => u.role === 'USER');
    const supervisors = createdUsers.filter(u => u.role === 'SUPERVISOR');

    // 2. Crear tickets variados
    console.log('\n🎫 Creando tickets...');
    
    const ticketTemplates = [
      // Tickets OPEN (nuevos, sin asignar)
      { title: 'Impresora de facturación no funciona', description: 'La impresora de la caja 3 no imprime correctamente. Las facturas salen borrosas.', priority: 'HIGH', status: 'OPEN', category: 'Hardware', daysAgo: 2 },
      { title: 'Error en sistema de punto de venta', description: 'El sistema se cierra inesperadamente al procesar pagos con tarjeta.', priority: 'URGENT', status: 'OPEN', category: 'Software', daysAgo: 1 },
      { title: 'Falla en conexión de red', description: 'No hay conexión a internet en el área de almacén.', priority: 'HIGH', status: 'OPEN', category: 'Red', daysAgo: 3 },
      { title: 'Teclado de caja no responde', description: 'Algunas teclas del teclado de la caja 5 no funcionan.', priority: 'MEDIUM', status: 'OPEN', category: 'Hardware', daysAgo: 5 },
      { title: 'Pantalla táctil dañada', description: 'La pantalla táctil del punto de venta tiene un área sin respuesta.', priority: 'MEDIUM', status: 'OPEN', category: 'Hardware', daysAgo: 4 },
      
      // Tickets ASSIGNED (asignados pero no iniciados)
      { title: 'Actualización de software requerida', description: 'Necesitamos actualizar el sistema de inventario a la última versión.', priority: 'MEDIUM', status: 'ASSIGNED', category: 'Software', daysAgo: 7, assignTechnician: true },
      { title: 'Instalación de nuevo servidor', description: 'Instalar y configurar nuevo servidor en sala de servidores.', priority: 'HIGH', status: 'ASSIGNED', category: 'Infraestructura', daysAgo: 6, assignTechnician: true },
      { title: 'Configuración de impresora fiscal', description: 'Configurar nueva impresora fiscal en caja 7.', priority: 'HIGH', status: 'ASSIGNED', category: 'Hardware', daysAgo: 5, assignTechnician: true },
      { title: 'Respaldo de base de datos', description: 'Realizar respaldo completo de la base de datos del sistema.', priority: 'MEDIUM', status: 'ASSIGNED', category: 'Mantenimiento', daysAgo: 8, assignTechnician: true },
      
      // Tickets IN_PROGRESS (en trabajo)
      { title: 'Reemplazo de switch de red', description: 'El switch principal necesita ser reemplazado por fallas intermitentes.', priority: 'HIGH', status: 'IN_PROGRESS', category: 'Red', daysAgo: 10, assignTechnician: true, addComment: true },
      { title: 'Migración de datos a nuevo sistema', description: 'Migrar datos históricos al nuevo sistema de gestión.', priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Software', daysAgo: 12, assignTechnician: true, addComment: true },
      { title: 'Reparación de servidor de archivos', description: 'El servidor de archivos presenta errores al acceder a documentos compartidos.', priority: 'URGENT', status: 'IN_PROGRESS', category: 'Infraestructura', daysAgo: 9, assignTechnician: true, addComment: true },
      { title: 'Instalación de cámaras de seguridad', description: 'Instalar sistema de cámaras de seguridad IP en áreas críticas.', priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Seguridad', daysAgo: 15, assignTechnician: true, addComment: true },
      
      // Tickets PENDING (en espera)
      { title: 'Reparación de escáner de código de barras', description: 'Esperando repuesto para el escáner dañado.', priority: 'MEDIUM', status: 'PENDING', category: 'Hardware', daysAgo: 20, assignTechnician: true, addComment: true },
      { title: 'Actualización de licencias de software', description: 'Esperando aprobación presupuestaria para renovar licencias.', priority: 'LOW', status: 'PENDING', category: 'Software', daysAgo: 18, assignTechnician: true, addComment: true },
      { title: 'Reemplazo de batería UPS', description: 'Esperando entrega de baterías para el sistema UPS.', priority: 'MEDIUM', status: 'PENDING', category: 'Infraestructura', daysAgo: 25, assignTechnician: true, addComment: true },
      
      // Tickets RESOLVED (resueltos)
      { title: 'Configuración de acceso remoto', description: 'Configurar VPN para acceso remoto seguro.', priority: 'MEDIUM', status: 'RESOLVED', category: 'Red', daysAgo: 30, assignTechnician: true, addComment: true, resolved: true },
      { title: 'Reparación de teclado de caja', description: 'Limpiar y reparar teclado que tenía teclas pegadas.', priority: 'LOW', status: 'RESOLVED', category: 'Hardware', daysAgo: 28, assignTechnician: true, addComment: true, resolved: true },
      { title: 'Actualización de antivirus', description: 'Actualizar licencias y software antivirus en todos los equipos.', priority: 'MEDIUM', status: 'RESOLVED', category: 'Seguridad', daysAgo: 35, assignTechnician: true, addComment: true, resolved: true },
      { title: 'Instalación de nuevo punto de venta', description: 'Instalar y configurar nuevo punto de venta en caja 8.', priority: 'HIGH', status: 'RESOLVED', category: 'Hardware', daysAgo: 32, assignTechnician: true, addComment: true, resolved: true },
      { title: 'Corrección de error en reportes', description: 'Corregir error que generaba reportes incorrectos en el sistema.', priority: 'MEDIUM', status: 'RESOLVED', category: 'Software', daysAgo: 40, assignTechnician: true, addComment: true, resolved: true },
      { title: 'Reparación de conexión de red', description: 'Reparar cableado de red dañado en almacén.', priority: 'HIGH', status: 'RESOLVED', category: 'Red', daysAgo: 38, assignTechnician: true, addComment: true, resolved: true },
      
      // Tickets CLOSED (cerrados)
      { title: 'Reemplazo de monitor dañado', description: 'Reemplazar monitor de punto de venta que tenía pixeles muertos.', priority: 'MEDIUM', status: 'CLOSED', category: 'Hardware', daysAgo: 45, assignTechnician: true, addComment: true, resolved: true, closed: true },
      { title: 'Configuración de email corporativo', description: 'Configurar cuentas de email corporativo para nuevo personal.', priority: 'LOW', status: 'CLOSED', category: 'Software', daysAgo: 50, assignTechnician: true, addComment: true, resolved: true, closed: true },
      { title: 'Instalación de sistema de respaldo', description: 'Instalar y configurar sistema automático de respaldo de datos.', priority: 'HIGH', status: 'CLOSED', category: 'Infraestructura', daysAgo: 55, assignTechnician: true, addComment: true, resolved: true, closed: true },
      { title: 'Reparación de impresora de etiquetas', description: 'Reparar impresora de etiquetas que tenía problemas de alineación.', priority: 'MEDIUM', status: 'CLOSED', category: 'Hardware', daysAgo: 48, assignTechnician: true, addComment: true, resolved: true, closed: true },
      { title: 'Actualización de sistema operativo', description: 'Actualizar sistemas operativos de equipos administrativos.', priority: 'MEDIUM', status: 'CLOSED', category: 'Software', daysAgo: 60, assignTechnician: true, addComment: true, resolved: true, closed: true },
      
      // Tickets CANCELLED (cancelados)
      { title: 'Solicitud de nuevo equipo duplicada', description: 'Esta solicitud fue cancelada porque ya existe otra similar.', priority: 'LOW', status: 'CANCELLED', category: 'Hardware', daysAgo: 15, addComment: true },
      { title: 'Problema resuelto por usuario', description: 'El problema se resolvió antes de que el técnico pudiera intervenir.', priority: 'LOW', status: 'CANCELLED', category: 'Software', daysAgo: 22, addComment: true },
    ];

    const createdTickets = [];
    let ticketCount = 0;

    for (const template of ticketTemplates) {
      const branch = branches[Math.floor(Math.random() * branches.length)];
      const branchDepts = departmentsByBranch[branch.id] || departmentsByBranch['null'] || departments;
      const department = branchDepts[Math.floor(Math.random() * branchDepts.length)];
      const requester = regularUsers[Math.floor(Math.random() * regularUsers.length)];
      const assignedTechnician = template.assignTechnician && technicians.length > 0 
        ? technicians[Math.floor(Math.random() * technicians.length)] 
        : null;

      const createdAt = getRandomDate(template.daysAgo);
      const ticketNumber = await generateUniqueTicketNumber();

      const ticketData = {
        ticketNumber,
        title: template.title,
        description: template.description,
        priority: template.priority,
        status: template.status,
        category: template.category,
        requestedById: requester.id,
        departmentId: department.id,
        branchId: branch.id,
        assignedToId: assignedTechnician?.id || null,
        createdAt,
        updatedAt: createdAt,
      };

      let resolvedAt = null;
      if (template.resolved) {
        resolvedAt = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // Entre 0-7 días después
        ticketData.resolvedAt = resolvedAt;
        ticketData.resolution = 'Problema resuelto exitosamente. Se realizaron las pruebas correspondientes y todo funciona correctamente.';
        ticketData.updatedAt = resolvedAt;
      }

      const ticket = await prisma.ticket.create({
        data: ticketData,
      });

      createdTickets.push(ticket);
      ticketCount++;

      // Crear historial
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          action: 'CREATED',
          changedBy: requester.id,
          newValue: 'OPEN',
        },
      });

      if (assignedTechnician) {
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            action: 'ASSIGNED',
            changedBy: requester.id, // O un admin
            oldValue: null,
            newValue: assignedTechnician.id,
            createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60), // 1 hora después
          },
        });
      }

      if (template.status !== 'OPEN') {
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            action: 'STATUS_CHANGED',
            changedBy: assignedTechnician?.id || requester.id,
            oldValue: 'OPEN',
            newValue: template.status,
            createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * 2), // 2 horas después
          },
        });
      }

      if (template.resolved) {
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            action: 'STATUS_CHANGED',
            changedBy: assignedTechnician.id,
            oldValue: template.status,
            newValue: 'RESOLVED',
            createdAt: ticket.resolvedAt,
          },
        });
      }

      if (template.closed && ticket.resolvedAt) {
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            action: 'STATUS_CHANGED',
            changedBy: requester.id,
            oldValue: 'RESOLVED',
            newValue: 'CLOSED',
            createdAt: new Date(ticket.resolvedAt.getTime() + 1000 * 60 * 60 * 24), // 1 día después
          },
        });
      }

      // Agregar comentarios
      if (template.addComment) {
        const commenter = assignedTechnician || (Math.random() > 0.5 ? requester : supervisors[0]);
        const commentTexts = {
          IN_PROGRESS: [
            'Estoy trabajando en esto. Ya identifiqué el problema y estoy aplicando la solución.',
            'En proceso de diagnóstico. Necesito revisar algunos componentes adicionales.',
            'Trabajando en la solución. Estimado de resolución: 2-3 horas.',
            'Problema identificado. Procediendo con la reparación/instalación.',
          ],
          PENDING: [
            'Esperando repuesto. Se ha ordenado y llegará en los próximos días.',
            'Esperando aprobación presupuestaria para continuar.',
            'Esperando información adicional del usuario para proceder.',
            'Pausado temporalmente. Esperando condiciones favorables para continuar.',
          ],
          RESOLVED: [
            'Problema resuelto. Se realizaron pruebas y todo funciona correctamente.',
            'Instalación/Reparación completada exitosamente. Sistema operativo normal.',
            'Corrección aplicada. Por favor verificar que todo funcione según lo esperado.',
            'Trabajo completado. El sistema está funcionando normalmente.',
          ],
          CLOSED: [
            'Ticket cerrado. Todo funcionando correctamente.',
            'Problema resuelto y verificado por el usuario.',
            'Cierre confirmado. No se requieren acciones adicionales.',
          ],
          CANCELLED: [
            'Ticket cancelado: Solicitud duplicada.',
            'Cancelado: El problema se resolvió sin intervención técnica.',
            'Ticket cancelado: No aplicable.',
          ],
        };

        const statusComments = commentTexts[template.status] || commentTexts.RESOLVED;
        const commentText = statusComments[Math.floor(Math.random() * statusComments.length)];

        await prisma.comment.create({
          data: {
            content: commentText,
            ticketId: ticket.id,
            userId: commenter.id,
            createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * (template.resolved ? 3 : 2)),
          },
        });
      }

      if (ticketCount % 5 === 0) {
        console.log(`  ✅ ${ticketCount} tickets creados...`);
      }
    }

    console.log(`\n✅ Total: ${createdTickets.length} tickets creados`);

    // 3. Estadísticas
    console.log('\n📊 Estadísticas de datos creados:');
    const statusCounts = {};
    const priorityCounts = {};
    createdTickets.forEach(t => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });

    console.log('\n  Por Estado:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });

    console.log('\n  Por Prioridad:');
    Object.entries(priorityCounts).forEach(([priority, count]) => {
      console.log(`    ${priority}: ${count}`);
    });

    console.log(`\n  Usuarios creados: ${createdUsers.length}`);
    console.log(`  Tickets creados: ${createdTickets.length}`);
    console.log(`  Sucursales utilizadas: ${branches.length}`);
    console.log(`  Departamentos utilizados: ${departments.length}`);

    console.log('\n✨ Carga de datos de demostración completada!');
    console.log('\n💡 Puedes iniciar sesión con cualquiera de estos usuarios:');
    console.log('   Email: cualquier usuario creado');
    console.log('   Password: password123');
    console.log('\n   Ejemplos:');
    createdUsers.slice(0, 5).forEach(u => {
      console.log(`   - ${u.email} (${u.role})`);
    });

  } catch (error) {
    console.error('❌ Error al cargar datos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });