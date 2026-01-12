const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateBranches() {
  try {
    console.log('🔄 Iniciando actualización de sucursales...\n');

    // 1. Desactivar todas las sucursales existentes (mantener integridad referencial)
    console.log('📋 Desactivando sucursales existentes...');
    const oldBranches = await prisma.branch.findMany({
      where: { isActive: true }
    });

    if (oldBranches.length > 0) {
      await prisma.branch.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      console.log(`  ⚠️  ${oldBranches.length} sucursales desactivadas (mantenidas para integridad referencial)`);
    }

    // 2. Crear las nuevas sucursales
    console.log('\n📍 Creando nuevas sucursales...');
    const newBranches = [
      {
        code: 'LT-001',
        name: 'LT Central (Casa matriz)',
        address: 'Av. Gral. Elizardo Aquino',
        city: 'Limpio',
        state: 'Dpto. Central',
        isActive: true,
      },
      {
        code: 'LT-002',
        name: 'LT Express Villa Madrid',
        address: 'Gral. Elizardo Aquino c/ Capitán Andrés Insfrán',
        city: 'Limpio',
        state: 'Dpto. Central',
        isActive: true,
      },
      {
        code: 'LT-003',
        name: 'LT Express Mora Cué',
        address: 'Tupa Rekavo casi Capitán Insfrán',
        city: 'Luque',
        state: 'Dpto. Central',
        isActive: true,
      },
      {
        code: 'LT-004',
        name: 'LT Express Villa Hayes',
        address: 'Ruta Transchaco km 32',
        city: 'Villa Hayes',
        state: 'Pte. Hayes',
        isActive: true,
      },
      {
        code: 'LT-005',
        name: 'LT Express Centro',
        address: 'Av. San Roque González',
        city: 'Limpio',
        state: 'Dpto. Central',
        isActive: true,
      },
      {
        code: 'LT-006',
        name: 'LT Express Mariano Roque Alonso',
        address: 'Av. Transchaco y Gral. Genes',
        city: 'Mariano R. Alonso',
        state: 'Dpto. Central',
        isActive: true,
      },
    ];

    const createdBranches = [];
    for (const branchData of newBranches) {
      const existing = await prisma.branch.findUnique({
        where: { code: branchData.code },
      });

      if (!existing) {
        const branch = await prisma.branch.create({
          data: branchData,
        });
        createdBranches.push(branch);
        console.log(`  ✅ ${branch.name} (${branch.code})`);
      } else {
        // Si ya existe, actualizarlo y activarlo
        const branch = await prisma.branch.update({
          where: { code: branchData.code },
          data: {
            ...branchData,
            isActive: true,
          },
        });
        createdBranches.push(branch);
        console.log(`  🔄 ${branch.name} (${branch.code}) - Actualizada`);
      }
    }

    // 3. Crear departamentos para cada nueva sucursal
    console.log('\n🏢 Creando departamentos para las nuevas sucursales...');
    
    const departmentsByBranch = [
      {
        name: 'Caja y Facturación',
        code: 'CAJA',
        description: 'Sistemas de punto de venta, cajas registradoras, impresoras de tickets',
      },
      {
        name: 'Almacén y Logística',
        code: 'ALMACEN',
        description: 'Control de inventario, recepción de mercadería, almacenamiento',
      },
      {
        name: 'Carnicería',
        code: 'CARNICERIA',
        description: 'Equipos de frío, balanzas, sistemas de corte',
      },
      {
        name: 'Panadería',
        code: 'PANADERIA',
        description: 'Hornos, máquinas de amasado, vitrinas',
      },
      {
        name: 'Fiambrería',
        code: 'FIAMBRERIA',
        description: 'Equipos de frío, cortadoras, balanzas',
      },
      {
        name: 'Pescadería',
        code: 'PESCADERIA',
        description: 'Equipos de frío, vitrinas, sistemas de pesaje',
      },
      {
        name: 'Verdulería',
        code: 'VERDULERIA',
        description: 'Vitrinas, balanzas, sistemas de exhibición',
      },
      {
        name: 'Farmacia',
        code: 'FARMACIA',
        description: 'Sistemas de gestión, impresoras de recetas',
      },
      {
        name: 'Perfumería',
        code: 'PERFUMERIA',
        description: 'Sistemas de venta y control de inventario',
      },
      {
        name: 'Limpieza y Mantenimiento',
        code: 'LIMPIEZA',
        description: 'Equipos de limpieza, sistemas de mantenimiento',
      },
      {
        name: 'Seguridad',
        code: 'SEGURIDAD',
        description: 'Cámaras, alarmas, control de acceso',
      },
      {
        name: 'Recursos Humanos',
        code: 'RRHH',
        description: 'Sistemas de gestión de personal, control de asistencia',
      },
      {
        name: 'Contabilidad',
        code: 'CONTABILIDAD',
        description: 'Sistemas contables, reportes financieros',
      },
      {
        name: 'Marketing',
        code: 'MARKETING',
        description: 'Sistemas de promociones, publicidad digital',
      },
      {
        name: 'Atención al Cliente',
        code: 'ATENCION',
        description: 'Sistemas de reclamos, atención telefónica',
      },
      {
        name: 'Soporte TI',
        code: 'SOPORTE_TI',
        description: 'Soporte técnico informático, mantenimiento de sistemas, infraestructura',
      },
    ];

    let deptCount = 0;
    for (const branch of createdBranches) {
      console.log(`\n  📂 Sucursal: ${branch.name}`);
      
      for (const deptData of departmentsByBranch) {
        // Verificar si ya existe
        const existing = await prisma.department.findFirst({
          where: {
            code: deptData.code,
            branchId: branch.id,
          },
        });

        if (!existing) {
          await prisma.department.create({
            data: {
              ...deptData,
              branchId: branch.id,
              isActive: true,
            },
          });
          console.log(`    ✅ ${deptData.name}`);
          deptCount++;
        } else {
          console.log(`    ⚠️  ${deptData.name} ya existe`);
        }
      }
    }

    console.log(`\n✨ Actualización completada!`);
    console.log(`   📍 ${createdBranches.length} nuevas sucursales creadas/actualizadas`);
    console.log(`   🏢 ${deptCount} departamentos creados`);
    console.log(`   ⚠️  ${oldBranches.length} sucursales antiguas desactivadas (mantenidas para integridad referencial)`);
    console.log(`\n💡 Las nuevas sucursales están activas y listas para usar.`);

  } catch (error) {
    console.error('❌ Error al actualizar sucursales:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBranches()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

