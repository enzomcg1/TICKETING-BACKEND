const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedData() {
  try {
    console.log('🌱 Iniciando carga de datos iniciales...\n');

    // 1. Crear Sucursales
    console.log('📍 Creando sucursales...');
    const branches = [
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
    for (const branchData of branches) {
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
        console.log(`  ⚠️  ${branchData.name} ya existe`);
        createdBranches.push(existing);
      }
    }

    // 2. Crear Departamentos por Sucursal
    console.log('\n🏢 Creando departamentos...');
    
    // Departamentos comunes para todas las sucursales
    const commonDepartments = [
      // Administración y gestión
      {
        name: 'Gerencia local',
        code: 'GERENCIA',
        description: 'Gestión y dirección de la sucursal',
        onlyHeadquarters: false
      },
      {
        name: 'Administración / contabilidad',
        code: 'ADMIN_CONTABILIDAD',
        description: 'Administración financiera y contable de la sucursal',
        onlyHeadquarters: false
      },
      {
        name: 'Recursos humanos',
        code: 'RRHH',
        description: 'Gestión de personal y recursos humanos',
        onlyHeadquarters: false
      },
      // Operaciones
      {
        name: 'Caja y atención al cliente',
        code: 'CAJA_ATENCION',
        description: 'Cajas registradoras y atención al cliente',
        onlyHeadquarters: false
      },
      {
        name: 'Reposición y góndolas',
        code: 'REPOSICION',
        description: 'Reposición de productos en góndolas y exhibición',
        onlyHeadquarters: false
      },
      {
        name: 'Almacén / depósito',
        code: 'ALMACEN',
        description: 'Almacenamiento y gestión de inventario',
        onlyHeadquarters: false
      },
      {
        name: 'Control de stock',
        code: 'CONTROL_STOCK',
        description: 'Control y gestión de inventario',
        onlyHeadquarters: false
      },
      // Ventas y marketing
      {
        name: 'Ventas minoristas',
        code: 'VENTAS',
        description: 'Ventas al por menor y gestión comercial',
        onlyHeadquarters: false
      },
      {
        name: 'Promociones / marketing local',
        code: 'MARKETING',
        description: 'Promociones y marketing local',
        onlyHeadquarters: false
      },
      // Logística y abastecimiento
      {
        name: 'Recepción de mercaderías',
        code: 'RECEPCION',
        description: 'Recepción y verificación de mercaderías',
        onlyHeadquarters: false
      },
      {
        name: 'Distribución interna',
        code: 'DISTRIBUCION',
        description: 'Distribución interna de productos',
        onlyHeadquarters: false
      },
      {
        name: 'Transporte',
        code: 'TRANSPORTE',
        description: 'Servicios de transporte y logística',
        onlyHeadquarters: false
      },
      // Mantenimiento y soporte
      {
        name: 'Limpieza y mantenimiento',
        code: 'LIMPIEZA',
        description: 'Limpieza y mantenimiento de instalaciones',
        onlyHeadquarters: false
      },
      {
        name: 'Seguridad / vigilancia',
        code: 'SEGURIDAD',
        description: 'Seguridad y vigilancia de la sucursal',
        onlyHeadquarters: false
      },
      {
        name: 'Sistemas / soporte técnico',
        code: 'SOPORTE_TI',
        description: 'Soporte técnico informático y sistemas',
        onlyHeadquarters: false
      },
    ];

    // Departamentos solo para casa matriz
    const headquartersDepartments = [
      {
        name: 'Dirección general',
        code: 'DIRECCION_GENERAL',
        description: 'Dirección general de la empresa',
        onlyHeadquarters: true
      },
      {
        name: 'Compras centrales',
        code: 'COMPRAS_CENTRALES',
        description: 'Compras centralizadas de la empresa',
        onlyHeadquarters: true
      },
      {
        name: 'Auditoría interna',
        code: 'AUDITORIA',
        description: 'Auditoría interna y control',
        onlyHeadquarters: true
      },
      {
        name: 'Finanzas',
        code: 'FINANZAS',
        description: 'Gestión financiera corporativa',
        onlyHeadquarters: true
      },
      {
        name: 'Legal / cumplimiento',
        code: 'LEGAL',
        description: 'Asuntos legales y cumplimiento normativo',
        onlyHeadquarters: true
      },
    ];

    const departmentsByBranch = [...commonDepartments];

    let deptCount = 0;
    const headquarters = createdBranches.find(b => b.code === 'LT-001');
    
    for (const branch of createdBranches) {
      console.log(`\n  📂 Sucursal: ${branch.name}`);
      
      // Determinar qué departamentos crear según la sucursal
      const departmentsForBranch = branch.code === 'LT-001' 
        ? [...commonDepartments, ...headquartersDepartments]
        : commonDepartments;
      
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
          console.log(`    ✅ ${deptData.name}`);
          deptCount++;
        } else {
          console.log(`    ⚠️  ${deptData.name} ya existe`);
        }
      }
    }

    console.log(`\n✨ Carga de datos completada!`);
    console.log(`   📍 ${createdBranches.length} sucursales`);
    console.log(`   🏢 ${deptCount} departamentos creados`);
    console.log(`\n💡 Ahora puedes crear tickets asociados a estas sucursales y departamentos.`);

  } catch (error) {
    console.error('❌ Error al cargar datos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedData()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

