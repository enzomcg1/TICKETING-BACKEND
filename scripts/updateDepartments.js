const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateDepartments() {
  try {
    console.log('🔄 Iniciando actualización de departamentos...\n');

    // 1. Obtener todas las sucursales activas
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    });

    if (branches.length === 0) {
      console.log('❌ No hay sucursales activas. Ejecuta primero el script de actualización de sucursales.');
      return;
    }

    // 2. Desactivar todos los departamentos existentes
    console.log('📋 Desactivando departamentos existentes...');
    const oldDepartments = await prisma.department.findMany({
      where: { isActive: true }
    });

    if (oldDepartments.length > 0) {
      await prisma.department.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      console.log(`  ⚠️  ${oldDepartments.length} departamentos desactivados (mantenidos para integridad referencial)`);
    }

    // 3. Definir los nuevos departamentos
    const departmentCategories = [
      // Administración y gestión
      {
        name: 'Gerencia local',
        code: 'GERENCIA',
        description: 'Gestión y dirección de la sucursal',
        category: 'Administración y gestión',
        onlyHeadquarters: false
      },
      {
        name: 'Administración / contabilidad',
        code: 'ADMIN_CONTABILIDAD',
        description: 'Administración financiera y contable de la sucursal',
        category: 'Administración y gestión',
        onlyHeadquarters: false
      },
      {
        name: 'Recursos humanos',
        code: 'RRHH',
        description: 'Gestión de personal y recursos humanos',
        category: 'Administración y gestión',
        onlyHeadquarters: false
      },
      // Operaciones
      {
        name: 'Caja y atención al cliente',
        code: 'CAJA_ATENCION',
        description: 'Cajas registradoras y atención al cliente',
        category: 'Operaciones',
        onlyHeadquarters: false
      },
      {
        name: 'Reposición y góndolas',
        code: 'REPOSICION',
        description: 'Reposición de productos en góndolas y exhibición',
        category: 'Operaciones',
        onlyHeadquarters: false
      },
      {
        name: 'Almacén / depósito',
        code: 'ALMACEN',
        description: 'Almacenamiento y gestión de inventario',
        category: 'Operaciones',
        onlyHeadquarters: false
      },
      {
        name: 'Control de stock',
        code: 'CONTROL_STOCK',
        description: 'Control y gestión de inventario',
        category: 'Operaciones',
        onlyHeadquarters: false
      },
      // Ventas y marketing
      {
        name: 'Ventas minoristas',
        code: 'VENTAS',
        description: 'Ventas al por menor y gestión comercial',
        category: 'Ventas y marketing',
        onlyHeadquarters: false
      },
      {
        name: 'Promociones / marketing local',
        code: 'MARKETING',
        description: 'Promociones y marketing local',
        category: 'Ventas y marketing',
        onlyHeadquarters: false
      },
      // Logística y abastecimiento
      {
        name: 'Recepción de mercaderías',
        code: 'RECEPCION',
        description: 'Recepción y verificación de mercaderías',
        category: 'Logística y abastecimiento',
        onlyHeadquarters: false
      },
      {
        name: 'Distribución interna',
        code: 'DISTRIBUCION',
        description: 'Distribución interna de productos',
        category: 'Logística y abastecimiento',
        onlyHeadquarters: false
      },
      {
        name: 'Transporte',
        code: 'TRANSPORTE',
        description: 'Servicios de transporte y logística',
        category: 'Logística y abastecimiento',
        onlyHeadquarters: false
      },
      // Mantenimiento y soporte
      {
        name: 'Limpieza y mantenimiento',
        code: 'LIMPIEZA',
        description: 'Limpieza y mantenimiento de instalaciones',
        category: 'Mantenimiento y soporte',
        onlyHeadquarters: false
      },
      {
        name: 'Seguridad / vigilancia',
        code: 'SEGURIDAD',
        description: 'Seguridad y vigilancia de la sucursal',
        category: 'Mantenimiento y soporte',
        onlyHeadquarters: false
      },
      {
        name: 'Sistemas / soporte técnico',
        code: 'SOPORTE_TI',
        description: 'Soporte técnico informático y sistemas',
        category: 'Mantenimiento y soporte',
        onlyHeadquarters: false
      },
      // Dirección corporativa (solo casa matriz)
      {
        name: 'Dirección general',
        code: 'DIRECCION_GENERAL',
        description: 'Dirección general de la empresa',
        category: 'Dirección corporativa',
        onlyHeadquarters: true
      },
      {
        name: 'Compras centrales',
        code: 'COMPRAS_CENTRALES',
        description: 'Compras centralizadas de la empresa',
        category: 'Dirección corporativa',
        onlyHeadquarters: true
      },
      {
        name: 'Auditoría interna',
        code: 'AUDITORIA',
        description: 'Auditoría interna y control',
        category: 'Dirección corporativa',
        onlyHeadquarters: true
      },
      {
        name: 'Finanzas',
        code: 'FINANZAS',
        description: 'Gestión financiera corporativa',
        category: 'Dirección corporativa',
        onlyHeadquarters: true
      },
      {
        name: 'Legal / cumplimiento',
        code: 'LEGAL',
        description: 'Asuntos legales y cumplimiento normativo',
        category: 'Dirección corporativa',
        onlyHeadquarters: true
      },
    ];

    // 4. Identificar la casa matriz (LT-001)
    const headquarters = branches.find(b => b.code === 'LT-001');
    if (!headquarters) {
      console.log('⚠️  No se encontró la casa matriz (LT-001). Los departamentos corporativos no se crearán.');
    }

    // 5. Crear departamentos para cada sucursal
    console.log('\n🏢 Creando nuevos departamentos...');
    let totalCreated = 0;

    for (const branch of branches) {
      console.log(`\n  📂 Sucursal: ${branch.name} (${branch.code})`);

      // Filtrar departamentos según la sucursal
      const departmentsForBranch = departmentCategories.filter(dept => {
        // Si es solo para casa matriz, solo crear en LT-001
        if (dept.onlyHeadquarters) {
          return branch.code === 'LT-001';
        }
        // Para todas las demás sucursales, crear todos los departamentos excepto los corporativos
        return true;
      });

      for (const deptData of departmentsForBranch) {
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
              name: deptData.name,
              code: deptData.code,
              description: deptData.description,
              branchId: branch.id,
              isActive: true,
            },
          });
          console.log(`    ✅ ${deptData.name} [${deptData.category}]`);
          totalCreated++;
        } else {
          // Si existe, actualizarlo y activarlo
          await prisma.department.update({
            where: { id: existing.id },
            data: {
              name: deptData.name,
              description: deptData.description,
              isActive: true,
            },
          });
          console.log(`    🔄 ${deptData.name} [${deptData.category}] - Actualizado`);
        }
      }
    }

    // 6. Resumen por categoría
    console.log('\n📊 Resumen por categoría:');
    const categories = {};
    departmentCategories.forEach(dept => {
      if (!categories[dept.category]) {
        categories[dept.category] = [];
      }
      categories[dept.category].push(dept.name);
    });

    Object.keys(categories).forEach(category => {
      console.log(`\n  📁 ${category}:`);
      categories[category].forEach(deptName => {
        console.log(`    - ${deptName}`);
      });
    });

    console.log(`\n✨ Actualización completada!`);
    console.log(`   📍 ${branches.length} sucursales procesadas`);
    console.log(`   🏢 ${totalCreated} departamentos creados/actualizados`);
    console.log(`   ⚠️  ${oldDepartments.length} departamentos antiguos desactivados`);
    console.log(`\n💡 Los nuevos departamentos están activos y listos para usar.`);

  } catch (error) {
    console.error('❌ Error al actualizar departamentos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDepartments()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

