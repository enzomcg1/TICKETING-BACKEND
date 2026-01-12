-- Script de ejemplo para datos iniciales
-- Ejecutar después de crear las migraciones

-- Insertar sucursales de ejemplo
INSERT INTO "branches" (id, code, name, address, city, state, "isActive", "createdAt", "updatedAt")
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'SUC-001', 'Supermercado Central', 'Av. Principal 123', 'Buenos Aires', 'CABA', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'SUC-002', 'Supermercado Norte', 'Av. Norte 456', 'Buenos Aires', 'CABA', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'SUC-003', 'Supermercado Sur', 'Av. Sur 789', 'Buenos Aires', 'CABA', true, NOW(), NOW());

-- Insertar departamentos de ejemplo
INSERT INTO "departments" (id, name, code, description, "branchId", "isActive", "createdAt", "updatedAt")
VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', 'Ventas', 'VENTAS', 'Departamento de Ventas', '550e8400-e29b-41d4-a716-446655440001', true, NOW(), NOW()),
  ('660e8400-e29b-41d4-a716-446655440002', 'Almacén', 'ALMACEN', 'Departamento de Almacén', '550e8400-e29b-41d4-a716-446655440001', true, NOW(), NOW()),
  ('660e8400-e29b-41d4-a716-446655440003', 'Informática', 'IT', 'Departamento de Informática', '550e8400-e29b-41d4-a716-446655440001', true, NOW(), NOW()),
  ('660e8400-e29b-41d4-a716-446655440004', 'Recursos Humanos', 'RRHH', 'Departamento de Recursos Humanos', '550e8400-e29b-41d4-a716-446655440001', true, NOW(), NOW());

-- Nota: Los usuarios se deben crear a través de la aplicación o Prisma Studio
-- ya que las contraseñas deben estar hasheadas con bcrypt






