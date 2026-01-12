import express from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest, canViewAllTickets, canViewBranchTickets, canViewDepartmentTickets, canEditTicket, canAssignTicket, canAddComment } from '../middleware/auth';
import { notifyTicketStatusChange, notifyTicketCreated, notifyCommentAdded } from '../services/notificationService';
import { canChangeStatus, getAvailableStatusTransitions, statusLabels } from '../services/statusService';
import { TicketStatus } from '@prisma/client';
import { generateUniqueTicketNumber } from '../utils/ticketNumberGenerator';
import { loggerService } from '../services/loggerService';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = express.Router();

// GET /api/tickets - Listar tickets según permisos
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { status, priority, branchId, departmentId, search, searchType, userId, ticketId } = req.query;
    
    // Construir condiciones de búsqueda PRIMERO para detectar si es búsqueda por número inválida
    const searchConditions: any[] = [];
    let isExactNumberSearch = false;
    let exactTicketNumber: number | null = null;
    let invalidTicketNumberSearch = false; // Flag para indicar búsqueda inválida
    
    // Si es búsqueda por número de ticket inválida, NO procesar otros filtros
    if (search && searchType) {
      const searchTerm = (search as string).trim();
      const searchTypeParam = (searchType as string || 'all').toLowerCase();
      
      if (searchTypeParam === 'ticketnumber') {
        const isValidLength = searchTerm.length === 6;
        const isOnlyDigits = /^\d+$/.test(searchTerm);
        
        if (isValidLength && isOnlyDigits) {
          const ticketNum = parseInt(searchTerm, 10);
          if (!isNaN(ticketNum) && ticketNum >= 100000 && ticketNum <= 999999) {
            isExactNumberSearch = true;
            exactTicketNumber = ticketNum;
          } else {
            invalidTicketNumberSearch = true;
          }
        } else {
          invalidTicketNumberSearch = true;
        }
      }
    }
    
    // Si la búsqueda por número es inválida, devolver 0 resultados INMEDIATAMENTE
    if (invalidTicketNumberSearch) {
      console.log(`[GET /tickets] ⚠️ Búsqueda por número de ticket INVÁLIDA - FORZANDO 0 resultados`);
      return res.json([]); // Devolver array vacío directamente
    }
    
    // Si llegamos aquí, continuar con la lógica normal
    let where: any = {};
    
    // Filtros opcionales
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (branchId) {
      where.branchId = branchId;
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }
    
    if (userId) {
      searchConditions.push(
        { requestedById: userId as string },
        { assignedToId: userId as string }
      );
    }
    if (ticketId) {
      // Si es un número, buscar por ticketNumber, si no, buscar por ID
      const ticketIdStr = ticketId as string;
      if (/^\d{6}$/.test(ticketIdStr)) {
        const ticketNum = parseInt(ticketIdStr, 10);
        isExactNumberSearch = true;
        exactTicketNumber = ticketNum;
      } else {
        searchConditions.push({ id: { contains: ticketIdStr, mode: 'insensitive' } });
      }
    }
    if (search) {
      const searchTerm = (search as string).trim();
      const searchTypeParam = (searchType as string || 'all').toLowerCase();
      
      console.log(`[GET /tickets] Tipo de búsqueda: "${searchTypeParam}", Término: "${searchTerm}"`);
      
      // Búsqueda por número de ticket - SOLO cuando el tipo es "ticketNumber"
      // (Ya validado arriba, aquí solo procesamos si es válido)
      if (searchTypeParam === 'ticketnumber') {
        // Ya validado arriba, solo confirmar
        if (isExactNumberSearch && exactTicketNumber !== null) {
          console.log(`[GET /tickets] ✅ Búsqueda EXACTA por ticketNumber: ${exactTicketNumber}`);
        }
        // NO agregar a searchConditions, se manejará con isExactNumberSearch
      } 
      // Búsqueda SOLO en título
      else if (searchTypeParam === 'title') {
        searchConditions.push({ title: { contains: searchTerm, mode: 'insensitive' } });
        console.log(`[GET /tickets] Búsqueda SOLO en título: "${searchTerm}"`);
      } 
      // Búsqueda SOLO en descripción
      else if (searchTypeParam === 'description') {
        searchConditions.push({ description: { contains: searchTerm, mode: 'insensitive' } });
        console.log(`[GET /tickets] Búsqueda SOLO en descripción: "${searchTerm}"`);
      } 
      // Búsqueda SOLO en campos de usuario (nombre o email del solicitante o asignado)
      else if (searchTypeParam === 'user') {
        // Usar OR solo dentro de los campos de usuario, pero no buscar en otros campos
        searchConditions.push({
          OR: [
            { requestedBy: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { requestedBy: { email: { contains: searchTerm, mode: 'insensitive' } } },
            { assignedTo: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { assignedTo: { email: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        });
        console.log(`[GET /tickets] Búsqueda SOLO en usuarios: "${searchTerm}"`);
      } 
      // Búsqueda SOLO en campos de sucursal (nombre o código)
      else if (searchTypeParam === 'branch') {
        // Usar OR solo dentro de los campos de sucursal
        searchConditions.push({
          OR: [
            { branch: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { branch: { code: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        });
        console.log(`[GET /tickets] Búsqueda SOLO en sucursales: "${searchTerm}"`);
      } 
      // Búsqueda en todos los campos (comportamiento por defecto)
      else {
        searchConditions.push(
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { requestedBy: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { requestedBy: { email: { contains: searchTerm, mode: 'insensitive' } } },
          { assignedTo: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { branch: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { branch: { code: { contains: searchTerm, mode: 'insensitive' } } }
        );
        console.log(`[GET /tickets] Búsqueda en TODOS los campos: "${searchTerm}"`);
      }
    }

    // Construir filtros de permisos
    let permissionWhere: any = {};

    // ADMIN y AUDITOR: ver todos los tickets
    if (canViewAllTickets(user)) {
      // Sin filtro, ver todos
    }
    // SUPERVISOR: ver tickets de su sucursal/departamento
    else if (user.role === 'SUPERVISOR') {
      const supervisorConditions: any[] = [];
      if (user.branchId) {
        supervisorConditions.push({ branchId: user.branchId });
      }
      if (user.departmentId) {
        supervisorConditions.push({ departmentId: user.departmentId });
      }
      if (supervisorConditions.length > 0) {
        permissionWhere.OR = supervisorConditions;
      } else {
        // Si no tiene branchId ni departmentId, no puede ver ningún ticket
        permissionWhere.id = 'impossible-id-that-will-not-match';
      }
    }
    // TECHNICIAN: ver tickets asignados, tickets OPEN sin asignar, O tickets creados por USER (rol inferior)
    else if (user.role === 'TECHNICIAN') {
      // Usar AND dentro de OR para asegurar que ambos campos se evalúen correctamente
      permissionWhere.OR = [
        { assignedToId: user.id },
        { 
          AND: [
            { status: 'OPEN' },
            { assignedToId: null }
          ]
        },
        {
          // Tickets creados por usuarios con rol USER
          requestedBy: {
            role: 'USER'
          }
        }
      ];
    }
    // USER: ver solo sus propios tickets
    else if (user.role === 'USER') {
      permissionWhere.requestedById = user.id;
    }
    // Si no coincide con ningún rol conocido, no mostrar tickets
    else {
      console.warn(`[GET /tickets] Rol desconocido: ${user.role}`);
      permissionWhere.id = 'impossible-id-that-will-not-match';
    }

    // Si es búsqueda exacta por número, aplicarla directamente sin búsquedas de texto
    if (isExactNumberSearch && exactTicketNumber !== null) {
      // Búsqueda exacta por número de ticket - SOLO en ticketNumber
      // NO buscar en ningún otro campo
      where.ticketNumber = exactTicketNumber;
      
      // Agregar condiciones de permisos
      if (Object.keys(permissionWhere).length > 0) {
        const andConditions: any[] = [{ ticketNumber: exactTicketNumber }];
        
        if (permissionWhere.OR) {
          andConditions.push({ OR: permissionWhere.OR });
        } else {
          andConditions.push(permissionWhere);
        }
        
        where = {
          ...where,
          AND: andConditions
        };
      }
      
      // Log para depuración
      console.log(`[GET /tickets] Búsqueda EXACTA por número de ticket: ${exactTicketNumber}`);
      console.log(`[GET /tickets] WHERE final (número exacto):`, JSON.stringify(where, null, 2));
    }
    // Si hay condiciones de búsqueda de texto, combinarlas con permisos usando AND
    else if (searchConditions.length > 0) {
      // Si solo hay una condición, no usar OR (para búsquedas específicas)
      // Si hay múltiples condiciones, usar OR
      let searchWhere: any;
      if (searchConditions.length === 1) {
        // Búsqueda específica en un solo campo
        searchWhere = searchConditions[0];
      } else {
        // Múltiples condiciones (solo en modo "all")
        searchWhere = { OR: searchConditions };
      }
      
      const andConditions: any[] = [searchWhere];
      
      // Agregar condiciones de permisos
      if (Object.keys(permissionWhere).length > 0) {
        if (permissionWhere.OR) {
          andConditions.push({ OR: permissionWhere.OR });
        } else {
          andConditions.push(permissionWhere);
        }
      }
      
      // Combinar todos los filtros (status, priority, etc. ya están en where)
      where = {
        ...where,
        AND: andConditions
      };
      
      console.log(`[GET /tickets] Condiciones de búsqueda aplicadas:`, JSON.stringify(searchWhere, null, 2));
    } else {
      // Sin búsqueda, solo combinar permisos normalmente
      where = { ...where, ...permissionWhere };
    }

    // Log final antes de ejecutar la query
    console.log(`[GET /tickets] ===== QUERY FINAL =====`);
    console.log(`[GET /tickets] WHERE completo:`, JSON.stringify(where, null, 2));
    console.log(`[GET /tickets] invalidTicketNumberSearch: ${invalidTicketNumberSearch}`);
    console.log(`[GET /tickets] isExactNumberSearch: ${isExactNumberSearch}`);
    console.log(`[GET /tickets] exactTicketNumber: ${exactTicketNumber}`);
    
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        department: true,
        branch: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`[GET /tickets] Usuario: ${user.email} (${user.role}) - Filtro aplicado:`, JSON.stringify(where, null, 2));
    console.log(`[GET /tickets] Tickets encontrados: ${tickets.length}`);
    
    if (tickets.length > 0) {
      console.log(`[GET /tickets] Primer ticket:`, {
        id: tickets[0].id,
        title: tickets[0].title,
        requestedBy: tickets[0].requestedBy?.email,
        assignedTo: tickets[0].assignedTo?.email || 'Sin asignar',
        assignedToId: tickets[0].assignedToId,
        status: tickets[0].status
      });
    } else {
      console.log(`[GET /tickets] No se encontraron tickets con el filtro aplicado`);
    }
    
    res.json(tickets);
  } catch (error) {
    console.error('Error al obtener tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
});

// GET /api/tickets/export - Exportar tickets a CSV
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para que no se interprete "export" como un ID
router.get('/export', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo ADMIN, SUPERVISOR, AUDITOR y TECHNICIAN pueden exportar
    // USER no puede exportar
    if (user.role === 'USER') {
      return res.status(403).json({ error: 'No tienes permisos para exportar tickets' });
    }
    
    // Obtener usuario completo para tener acceso a name
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true }
    });
    if (!fullUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { status, priority, branchId, departmentId, startDate, endDate } = req.query;

    // Construir where clause según permisos del usuario
    const where: any = {};
    
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      // ADMIN y AUDITOR pueden ver todos los tickets
    } else if (user.role === 'SUPERVISOR') {
      // SUPERVISOR solo puede exportar tickets de SU SUCURSAL
      if (user.branchId) {
        where.branchId = user.branchId;
      } else {
        // Si no tiene branchId, no puede ver ningún ticket
        where.id = 'impossible-id-that-will-not-match';
      }
    } else if (user.role === 'TECHNICIAN') {
      // TECHNICIAN puede exportar tickets asignados a él, sin asignar, o creados por USER
      where.OR = [
        { assignedToId: user.id },
        { 
          AND: [
            { status: 'OPEN' },
            { assignedToId: null }
          ]
        },
        {
          requestedBy: {
            role: 'USER'
          }
        }
      ];
    } else {
      where.id = 'impossible-id-that-will-not-match';
    }

    // Aplicar filtros adicionales
    // NOTA: Para SUPERVISOR, no permitir filtrar por branchId diferente al suyo
    // Para TECHNICIAN, permitir filtrar por branchId si está dentro de sus tickets visibles
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (branchId && user.role !== 'SUPERVISOR') {
      // Solo permitir filtrar por branchId si no es SUPERVISOR (ya está filtrado por su sucursal)
      // Para TECHNICIAN, aplicar branchId al nivel superior usando AND con las condiciones OR existentes
      if (user.role === 'TECHNICIAN' && where.OR && Array.isArray(where.OR)) {
        // Envolver las condiciones OR existentes en un AND que también incluya branchId
        where.AND = [
          { OR: where.OR },
          { branchId: branchId }
        ];
        delete where.OR; // Eliminar OR ya que ahora está dentro de AND
      } else if (user.role !== 'TECHNICIAN') {
        where.branchId = branchId;
      }
    }
    if (departmentId) {
      // Para TECHNICIAN, aplicar departmentId al nivel superior usando AND
      if (user.role === 'TECHNICIAN' && where.AND && Array.isArray(where.AND)) {
        where.AND.push({ departmentId: departmentId });
      } else if (user.role === 'TECHNICIAN' && where.OR && Array.isArray(where.OR)) {
        // Si aún no se ha convertido a AND, convertir ahora
        where.AND = [
          { OR: where.OR },
          { departmentId: departmentId }
        ];
        delete where.OR;
      } else {
        where.departmentId = departmentId;
      }
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // Obtener tickets con toda la información relacionada
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        branch: {
          select: { id: true, name: true, code: true, city: true }
        },
        department: {
          select: { id: true, name: true, code: true }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            changedByUser: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Función para formatear fecha
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    // Función para obtener el estado del último cambio
    const getLastStatusChange = (ticket: any): string => {
      if (ticket.history && ticket.history.length > 0) {
        const lastChange = ticket.history[0];
        if (lastChange.action === 'STATUS_CHANGED') {
          return formatDate(lastChange.createdAt);
        }
      }
      return formatDate(ticket.updatedAt);
    };

    // Crear workbook de Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets');

    // Estilos empresariales
    const headerStyle = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFDC2626' } // Rojo empresarial
      },
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      },
      alignment: { 
        vertical: 'middle' as const, 
        horizontal: 'center' as const,
        wrapText: true
      }
    };

    const subHeaderStyle = {
      font: { bold: true, size: 11, color: { argb: 'FF1F2937' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFF3F4F6' } // Gris claro
      },
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      },
      alignment: { 
        vertical: 'middle' as const, 
        horizontal: 'center' as const,
        wrapText: true
      }
    };

    const cellStyle = {
      border: {
        top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } }
      },
      alignment: { 
        vertical: 'middle' as const, 
        horizontal: 'left' as const,
        wrapText: true
      }
    };

    // Agregar encabezado del reporte
    worksheet.mergeCells('A1:V2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'REPORTE DE TICKETS - SISTEMA DE GESTIÓN';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFDC2626' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    };

    // Información del reporte
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = `Exportado por: ${fullUser.name} (${fullUser.email})`;
    worksheet.getCell('A3').font = { size: 10, color: { argb: 'FF6B7280' } };
    
    worksheet.mergeCells('C3:D3');
    worksheet.getCell('C3').value = `Fecha: ${formatDate(new Date())}`;
    worksheet.getCell('C3').font = { size: 10, color: { argb: 'FF6B7280' } };
    worksheet.getCell('C3').alignment = { horizontal: 'right' };

    worksheet.mergeCells('E3:F3');
    worksheet.getCell('E3').value = `Total de tickets: ${tickets.length}`;
    worksheet.getCell('E3').font = { size: 10, color: { argb: 'FF6B7280' } };
    worksheet.getCell('E3').alignment = { horizontal: 'right' };

    // Encabezados de columnas
    const headers = [
      'Nº Ticket',
      'Título',
      'Descripción',
      'Estado',
      'Prioridad',
      'Categoría',
      'Solicitante',
      'Email Solicitante',
      'Técnico Asignado',
      'Email Técnico',
      'Sucursal',
      'Código Sucursal',
      'Ciudad',
      'Departamento',
      'Código Departamento',
      'Fecha Creación',
      'Fecha Actualización',
      'Fecha Resolución',
      'Resolución',
      'Último Cambio Estado',
      'Agente Cambio'
    ];

    // Agregar encabezados con estilo
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell, colNumber) => {
      cell.style = headerStyle;
    });

    // Agregar datos
    tickets.forEach((ticket, index) => {
      const lastStatusChange = ticket.history && ticket.history.length > 0 && ticket.history[0].action === 'STATUS_CHANGED'
        ? ticket.history[0].changedByUser.name
        : '';

      const row = worksheet.addRow([
        String(ticket.ticketNumber).padStart(6, '0'),
        ticket.title,
        ticket.description || '',
        statusLabels[ticket.status] || ticket.status,
        ticket.priority,
        ticket.category || '',
        ticket.requestedBy.name,
        ticket.requestedBy.email,
        ticket.assignedTo?.name || 'Sin asignar',
        ticket.assignedTo?.email || '',
        ticket.branch.name,
        ticket.branch.code,
        ticket.branch.city,
        ticket.department.name,
        ticket.department.code,
        formatDate(ticket.createdAt),
        formatDate(ticket.updatedAt),
        formatDate(ticket.resolvedAt),
        ticket.resolution || '',
        getLastStatusChange(ticket),
        lastStatusChange
      ]);

      // Aplicar estilo a las celdas
      row.eachCell((cell, colNumber) => {
        cell.style = cellStyle;
        // Colores alternados para filas
        if (index % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }
          };
        }
      });

      row.height = 20;
    });

    // Ajustar ancho de columnas
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 12; // Nº Ticket
      else if (index === 1) column.width = 30; // Título
      else if (index === 2) column.width = 40; // Descripción
      else if (index === 3) column.width = 15; // Estado
      else if (index === 4) column.width = 12; // Prioridad
      else if (index === 5) column.width = 15; // Categoría
      else if (index === 6) column.width = 20; // Solicitante
      else if (index === 7) column.width = 25; // Email Solicitante
      else if (index === 8) column.width = 20; // Técnico
      else if (index === 9) column.width = 25; // Email Técnico
      else if (index === 10) column.width = 20; // Sucursal
      else if (index === 11) column.width = 15; // Código Sucursal
      else if (index === 12) column.width = 15; // Ciudad
      else if (index === 13) column.width = 20; // Departamento
      else if (index === 14) column.width = 15; // Código Departamento
      else if (index === 15) column.width = 20; // Fecha Creación
      else if (index === 16) column.width = 20; // Fecha Actualización
      else if (index === 17) column.width = 20; // Fecha Resolución
      else if (index === 18) column.width = 40; // Resolución
      else if (index === 19) column.width = 20; // Último Cambio
      else if (index === 20) column.width = 20; // Agente Cambio
      else column.width = 15;
    });

    // Congelar primera fila (encabezados y fila de información)
    worksheet.views = [
      { state: 'frozen', ySplit: 4 }
    ];

    // Agregar filtros (fila 4 es la de encabezados de columnas)
    const lastRow = 4 + tickets.length;
    const lastCol = String.fromCharCode(64 + headers.length); // V = columna 22
    worksheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: lastRow, column: headers.length }
    };

    // Configurar headers para descarga
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `tickets_export_${dateStr}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '\\"')}"`);

    // Escribir Excel al response
    await workbook.xlsx.write(res);
    res.end();

    // Log de la exportación
    await loggerService.info(
      `Exportación de tickets a Excel realizada`,
      'TICKET',
      {
        userId: user.id,
        metadata: {
          filters: { status, priority, branchId, departmentId, startDate, endDate },
          totalTickets: tickets.length
        }
      }
    );

  } catch (error) {
    console.error('Error al exportar tickets:', error);
    res.status(500).json({ error: 'Error al exportar tickets' });
  }
});

// GET /api/tickets/export-pdf - Exportar tickets a PDF
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para que no se interprete "export-pdf" como un ID
router.get('/export-pdf', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo ADMIN, SUPERVISOR, AUDITOR y TECHNICIAN pueden exportar
    // USER no puede exportar
    if (user.role === 'USER') {
      return res.status(403).json({ error: 'No tienes permisos para exportar tickets' });
    }
    
    // Obtener usuario completo para tener acceso a name
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true }
    });
    if (!fullUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { status, priority, branchId, departmentId, startDate, endDate } = req.query;

    // Construir where clause según permisos del usuario (misma lógica que /export)
    const where: any = {};
    
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      // ADMIN y AUDITOR pueden ver todos los tickets
    } else if (user.role === 'SUPERVISOR') {
      // SUPERVISOR solo puede exportar tickets de SU SUCURSAL
      if (user.branchId) {
        where.branchId = user.branchId;
      } else {
        where.id = 'impossible-id-that-will-not-match';
      }
    } else if (user.role === 'TECHNICIAN') {
      // TECHNICIAN puede exportar tickets asignados a él, sin asignar, o creados por USER
      where.OR = [
        { assignedToId: user.id },
        { 
          AND: [
            { status: 'OPEN' },
            { assignedToId: null }
          ]
        },
        {
          requestedBy: {
            role: 'USER'
          }
        }
      ];
    } else {
      where.id = 'impossible-id-that-will-not-match';
    }

    // Aplicar filtros adicionales (misma lógica que /export)
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (branchId && user.role !== 'SUPERVISOR') {
      if (user.role === 'TECHNICIAN' && where.OR && Array.isArray(where.OR)) {
        where.AND = [
          { OR: where.OR },
          { branchId: branchId }
        ];
        delete where.OR;
      } else if (user.role !== 'TECHNICIAN') {
        where.branchId = branchId;
      }
    }
    if (departmentId) {
      if (user.role === 'TECHNICIAN' && where.AND && Array.isArray(where.AND)) {
        where.AND.push({ departmentId: departmentId });
      } else if (user.role === 'TECHNICIAN' && where.OR && Array.isArray(where.OR)) {
        where.AND = [
          { OR: where.OR },
          { departmentId: departmentId }
        ];
        delete where.OR;
      } else {
        where.departmentId = departmentId;
      }
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // Obtener tickets con toda la información relacionada
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        branch: {
          select: { id: true, name: true, code: true, city: true }
        },
        department: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Función para formatear fecha
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return d.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    // Configurar headers de respuesta PRIMERO (antes de generar el PDF)
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `tickets_export_${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '\\"')}"`);

    // Crear documento PDF
    const doc = new PDFDocument({ 
      margin: 40, 
      size: 'A4',
      info: {
        Title: 'Exportación de Tickets',
        Author: 'Sistema de Tickets',
        Subject: 'Reporte de Tickets',
        Creator: 'Sistema de Gestión de Tickets'
      }
    });
    
    // Colores empresariales
    const primaryRed = '#dc2626';
    const darkGray = '#1f2937';
    const lightGray = '#f3f4f6';
    const borderGray = '#e5e7eb';
    
    const pageWidth = doc.page.width - 80; // Ancho disponible menos márgenes
    const pageHeight = doc.page.height;
    let yPosition = 40;

    // Función para dibujar rectángulo con fondo
    const drawRect = (x: number, y: number, width: number, height: number, fillColor: string, strokeColor?: string) => {
      doc.save();
      doc.rect(x, y, width, height);
      doc.fillColor(fillColor);
      if (strokeColor) {
        doc.strokeColor(strokeColor);
        doc.fillAndStroke();
      } else {
        doc.fill();
      }
      doc.restore();
    };

    // Función para escribir texto con wrap automático
    const writeWrappedText = (text: string, fontSize: number = 10, color: string = '#000000') => {
      doc.fontSize(fontSize).fillColor(color);
      doc.text(text, {
        width: pageWidth,
        align: 'left'
      });
    };

    // Función para dibujar línea horizontal
    const drawLine = (y: number, color: string = borderGray, width: number = 1) => {
      doc.strokeColor(color).lineWidth(width)
        .moveTo(40, y)
        .lineTo(pageWidth + 40, y)
        .stroke();
    };

    // Función para dibujar tabla de información
    const drawInfoBox = (label: string, value: string, x: number, y: number, width: number, height: number = 20) => {
      // Fondo gris claro
      drawRect(x, y, width, height, lightGray, borderGray);
      // Label
      doc.fontSize(8).fillColor('#6b7280').text(label, x + 5, y + 3, { width: width - 10 });
      // Value
      doc.fontSize(10).fillColor(darkGray).text(value, x + 5, y + 12, { width: width - 10 });
    };

    // Pipe del documento a la respuesta
    doc.pipe(res);

    // Función para agregar encabezado en cada página
    const addHeader = () => {
      // Fondo rojo para el encabezado
      drawRect(0, 0, doc.page.width, 80, primaryRed);
      
      // Logo/Título en el encabezado
      doc.fontSize(24).fillColor('#ffffff').text('Sistema de Tickets', 40, 25, { align: 'left' });
      doc.fontSize(12).fillColor('#ffffff').text('Reporte de Exportación', 40, 50, { align: 'left' });
      
      // Fecha en la esquina superior derecha
      doc.fontSize(10).fillColor('#ffffff').text(formatDate(new Date()), pageWidth + 40 - 150, 30, { align: 'right' });
      
      yPosition = 100;
    };

    // Variable para contar páginas
    let pageNumber = 1;

    // Función para agregar pie de página
    const addFooter = () => {
      const footerY = pageHeight - 40;
      drawLine(footerY, borderGray);
      doc.fontSize(8).fillColor('#6b7280')
        .text(`Página ${pageNumber}`, 40, footerY + 10, { align: 'left' })
        .text(`Total de tickets: ${tickets.length}`, pageWidth + 40 - 150, footerY + 10, { align: 'right' });
    };

    // Agregar encabezado inicial
    addHeader();

    // Título del reporte
    doc.fontSize(18).fillColor(darkGray).text('REPORTE DE TICKETS', 40, yPosition, { align: 'center', width: pageWidth });
    yPosition += 30;
    
    // Información del reporte
    doc.fontSize(10).fillColor('#6b7280');
    doc.text(`Exportado por: ${fullUser.name} (${fullUser.email})`, 40, yPosition, { width: pageWidth / 2 });
    doc.text(`Total de tickets: ${tickets.length}`, pageWidth / 2 + 40, yPosition, { width: pageWidth / 2 });
    yPosition += 20;

    // Información de filtros aplicados
    if (status || priority || branchId || departmentId || startDate || endDate) {
      drawLine(yPosition, primaryRed, 2);
      yPosition += 15;
      doc.fontSize(12).fillColor(primaryRed).text('FILTROS APLICADOS', 40, yPosition, { width: pageWidth });
      yPosition += 20;
      
      const filterBoxWidth = pageWidth / 3 - 10;
      let filterX = 40;
      let filterY = yPosition;
      
      if (status) {
        drawInfoBox('Estado', statusLabels[status as TicketStatus] || status as string, filterX, filterY, filterBoxWidth);
        filterX += filterBoxWidth + 10;
        if (filterX + filterBoxWidth > pageWidth + 40) {
          filterX = 40;
          filterY += 25;
        }
      }
      if (priority) {
        drawInfoBox('Prioridad', priority as string, filterX, filterY, filterBoxWidth);
        filterX += filterBoxWidth + 10;
        if (filterX + filterBoxWidth > pageWidth + 40) {
          filterX = 40;
          filterY += 25;
        }
      }
      if (startDate) {
        drawInfoBox('Fecha Inicio', startDate as string, filterX, filterY, filterBoxWidth);
        filterX += filterBoxWidth + 10;
        if (filterX + filterBoxWidth > pageWidth + 40) {
          filterX = 40;
          filterY += 25;
        }
      }
      if (endDate) {
        drawInfoBox('Fecha Fin', endDate as string, filterX, filterY, filterBoxWidth);
        filterX += filterBoxWidth + 10;
        if (filterX + filterBoxWidth > pageWidth + 40) {
          filterX = 40;
          filterY += 25;
        }
      }
      
      yPosition = filterY + 30;
    }

    // Generar contenido para cada ticket
    tickets.forEach((ticket, index) => {
      // Verificar si necesitamos una nueva página
      if (yPosition > pageHeight - 200) {
        addFooter();
        doc.addPage();
        pageNumber++;
        addHeader();
        yPosition = 100;
      }

      // Separador entre tickets
      if (index > 0) {
        drawLine(yPosition, borderGray);
        yPosition += 15;
      }

      // Encabezado del ticket con fondo rojo
      const ticketHeaderHeight = 35;
      drawRect(40, yPosition, pageWidth, ticketHeaderHeight, primaryRed);
      doc.fontSize(16).fillColor('#ffffff')
        .text(`TICKET #${String(ticket.ticketNumber).padStart(6, '0')}`, 45, yPosition + 10, { width: pageWidth - 10 });
      doc.fontSize(12).fillColor('#ffffff')
        .text(ticket.title, 45, yPosition + 25, { width: pageWidth - 10 });
      yPosition += ticketHeaderHeight + 15;

      // Caja de información del ticket
      const infoBoxHeight = 25;
      const infoBoxWidth = (pageWidth - 20) / 2;
      
      // Primera fila de información
      drawInfoBox('Estado', statusLabels[ticket.status as TicketStatus] || ticket.status, 40, yPosition, infoBoxWidth, infoBoxHeight);
      drawInfoBox('Prioridad', ticket.priority, 40 + infoBoxWidth + 20, yPosition, infoBoxWidth, infoBoxHeight);
      yPosition += infoBoxHeight + 10;

      // Segunda fila
      if (ticket.category) {
        drawInfoBox('Categoría', ticket.category, 40, yPosition, infoBoxWidth, infoBoxHeight);
        drawInfoBox('Fecha Creación', formatDate(ticket.createdAt), 40 + infoBoxWidth + 20, yPosition, infoBoxWidth, infoBoxHeight);
      } else {
        drawInfoBox('Fecha Creación', formatDate(ticket.createdAt), 40, yPosition, infoBoxWidth, infoBoxHeight);
      }
      yPosition += infoBoxHeight + 10;

      // Tercera fila - Solicitante y Técnico
      drawInfoBox('Solicitante', ticket.requestedBy.name, 40, yPosition, infoBoxWidth, infoBoxHeight);
      drawInfoBox('Técnico Asignado', ticket.assignedTo?.name || 'Sin asignar', 40 + infoBoxWidth + 20, yPosition, infoBoxWidth, infoBoxHeight);
      yPosition += infoBoxHeight + 10;

      // Cuarta fila - Sucursal y Departamento
      drawInfoBox('Sucursal', `${ticket.branch.name} (${ticket.branch.code})`, 40, yPosition, infoBoxWidth, infoBoxHeight);
      drawInfoBox('Departamento', `${ticket.department.name} (${ticket.department.code})`, 40 + infoBoxWidth + 20, yPosition, infoBoxWidth, infoBoxHeight);
      yPosition += infoBoxHeight + 15;

      // Descripción con fondo
      drawRect(40, yPosition, pageWidth, 40, lightGray, borderGray);
      doc.fontSize(11).fillColor(primaryRed).text('DESCRIPCIÓN', 45, yPosition + 5, { width: pageWidth - 10 });
      yPosition += 20;
      const descriptionText = ticket.description || 'Sin descripción';
      doc.fontSize(10).fillColor(darkGray).text(descriptionText, 45, yPosition, { 
        width: pageWidth - 10,
        align: 'justify'
      });
      
      // Calcular altura de la descripción
      const descHeight = doc.heightOfString(descriptionText, {
        width: pageWidth - 10
      });
      yPosition += descHeight + 15;

      // Resolución si existe
      if (ticket.resolution) {
        if (yPosition > pageHeight - 150) {
          addFooter();
          doc.addPage();
          pageNumber++;
          addHeader();
          yPosition = 100;
        }
        drawRect(40, yPosition, pageWidth, 40, '#fef2f2', borderGray);
        doc.fontSize(11).fillColor(primaryRed).text('RESOLUCIÓN', 45, yPosition + 5, { width: pageWidth - 10 });
        yPosition += 20;
        doc.fontSize(10).fillColor(darkGray).text(ticket.resolution, 45, yPosition, { 
          width: pageWidth - 10,
          align: 'justify'
        });
        const resolutionHeight = doc.heightOfString(ticket.resolution, {
          width: pageWidth - 10
        });
        yPosition += resolutionHeight + 20;
      }

      // Información adicional
      if (ticket.resolvedAt) {
        drawInfoBox('Fecha de Resolución', formatDate(ticket.resolvedAt), 40, yPosition, infoBoxWidth, infoBoxHeight);
      }
      drawInfoBox('Última Actualización', formatDate(ticket.updatedAt), ticket.resolvedAt ? 40 + infoBoxWidth + 20 : 40, yPosition, infoBoxWidth, infoBoxHeight);
      yPosition += infoBoxHeight + 20;
    });

    // Agregar pie de página final
    addFooter();

    // Finalizar documento
    doc.end();

    // Log de la exportación (después de finalizar el documento)
    // No esperamos a que termine para no bloquear la respuesta
    loggerService.info(
      `Exportación de tickets a PDF realizada`,
      'TICKET',
      {
        userId: user.id,
        metadata: {
          filters: { status, priority, branchId, departmentId, startDate, endDate },
          totalTickets: tickets.length
        }
      }
    ).catch(err => {
      console.error('Error al registrar log de exportación PDF:', err);
    });

  } catch (error) {
    console.error('Error al exportar tickets a PDF:', error);
    // Si el stream ya se inició, no podemos enviar un error JSON
    // Solo logueamos el error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al exportar tickets a PDF', details: error instanceof Error ? error.message : 'Error desconocido' });
    } else {
      console.error('Error después de iniciar el stream PDF, no se puede enviar respuesta de error');
    }
  }
});

// GET /api/tickets/stats - Obtener estadísticas de tickets
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para que no se interprete "stats" como un ID
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    let where: any = {};

    // Aplicar mismos filtros de permisos que en GET /tickets
    if (canViewAllTickets(user)) {
      // Sin filtro, ver todos
      console.log(`[GET /tickets/stats] Usuario ${user.email} (${user.role}) - Puede ver todos los tickets`);
    } else if (user.role === 'SUPERVISOR') {
      const supervisorConditions: any[] = [];
      if (user.branchId) {
        supervisorConditions.push({ branchId: user.branchId });
      }
      if (user.departmentId) {
        supervisorConditions.push({ departmentId: user.departmentId });
      }
      if (supervisorConditions.length > 0) {
        where.OR = supervisorConditions;
      } else {
        where.id = 'impossible-id-that-will-not-match';
      }
      console.log(`[GET /tickets/stats] Usuario ${user.email} (${user.role}) - Filtro supervisor aplicado`);
    } else if (user.role === 'TECHNICIAN') {
      where.OR = [
        { assignedToId: user.id },
        { 
          AND: [
            { status: 'OPEN' },
            { assignedToId: null }
          ]
        },
        {
          requestedBy: {
            role: 'USER'
          }
        }
      ];
      console.log(`[GET /tickets/stats] Usuario ${user.email} (${user.role}) - Filtro técnico aplicado`);
    } else if (user.role === 'USER') {
      // USER solo puede ver SUS PROPIOS tickets
      where.requestedById = user.id;
      console.log(`[GET /tickets/stats] Usuario ${user.email} (${user.role}) - SOLO puede ver tickets donde requestedById = ${user.id}`);
    } else {
      where.id = 'impossible-id-that-will-not-match';
      console.log(`[GET /tickets/stats] Usuario ${user.email} (${user.role}) - Sin permisos, no mostrar tickets`);
    }
    
    console.log(`[GET /tickets/stats] WHERE clause:`, JSON.stringify(where, null, 2));

    // Obtener estadísticas agregadas
    // IMPORTANTE: El where ya contiene el filtro de requestedById para USER
    const [
      total,
      byStatus,
      byPriority,
      byBranch,
      byDepartment,
      recentTickets
    ] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true }
      }),
      prisma.ticket.groupBy({
        by: ['branchId'],
        where,
        _count: { branchId: true }
      }),
      prisma.ticket.groupBy({
        by: ['departmentId'],
        where,
        _count: { departmentId: true }
      }),
      prisma.ticket.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } }
        }
      })
    ]);

    // Log para depuración
    console.log(`[GET /tickets/stats] Total tickets encontrados: ${total}`);
    console.log(`[GET /tickets/stats] Tickets recientes: ${recentTickets.length}`);
    if (user.role === 'USER') {
      console.log(`[GET /tickets/stats] USER - Verificando que todos los tickets pertenezcan al usuario:`);
      recentTickets.forEach((t, idx) => {
        console.log(`  Ticket ${idx + 1}: requestedById=${t.requestedBy?.id}, user.id=${user.id}, coincide=${t.requestedBy?.id === user.id}`);
      });
    }

    // Obtener nombres de sucursales y departamentos
    const branchIds = byBranch.map(b => b.branchId).filter(Boolean) as string[];
    const departmentIds = byDepartment.map(d => d.departmentId).filter(Boolean) as string[];
    
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, code: true }
    });
    
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true, code: true }
    });

    const branchesMap = new Map(branches.map(b => [b.id, b]));
    const departmentsMap = new Map(departments.map(d => [d.id, d]));

    res.json({
      total,
      byStatus: byStatus.map(item => ({
        status: item.status,
        count: item._count.status,
        label: statusLabels[item.status as TicketStatus] || item.status
      })),
      byPriority: byPriority.map(item => ({
        priority: item.priority,
        count: item._count.priority
      })),
      byBranch: byBranch.map(item => ({
        branchId: item.branchId,
        branch: item.branchId ? branchesMap.get(item.branchId) : null,
        count: item._count.branchId
      })),
      byDepartment: byDepartment.map(item => ({
        departmentId: item.departmentId,
        department: item.departmentId ? departmentsMap.get(item.departmentId) : null,
        count: item._count.departmentId
      })),
      recentTickets
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/tickets/history - Obtener historial de cambios global (tickets + usuarios)
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para que no se interprete "history" como un ID
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo ADMIN y AUDITOR pueden ver el historial completo
    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      return res.status(403).json({ error: 'No tiene permisos para ver el historial de cambios' });
    }
    
    const {
      action,
      ticketId,
      changedBy,
      userSearch,
      category,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Si se proporciona userSearch, buscar usuarios que coincidan
    let userIds: string[] | undefined = undefined;
    if (userSearch && typeof userSearch === 'string' && userSearch.trim()) {
      const searchTerm = userSearch.trim();
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      userIds = matchingUsers.map(u => u.id);
      // Si no hay usuarios que coincidan, no mostrar ningún evento
      if (userIds.length === 0) {
        userIds = ['no-match-id-that-will-not-exist'];
      }
    }

    // Construir filtros para TicketHistory
    const historyWhere: any = {};

    if (action) {
      historyWhere.action = action;
    }

    if (ticketId) {
      historyWhere.ticketId = ticketId;
    }

    // Usar changedBy (ID específico) o userIds (búsqueda por texto)
    if (changedBy) {
      historyWhere.changedBy = changedBy;
    } else if (userIds) {
      historyWhere.changedBy = { in: userIds };
    }

    if (startDate || endDate) {
      historyWhere.createdAt = {};
      if (startDate) {
        historyWhere.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        historyWhere.createdAt.lte = new Date(endDate as string);
      }
    }

    // Construir filtros para SystemLog (solo eventos de usuarios)
    const logWhere: any = {
      category: 'USER', // Solo eventos relacionados con usuarios
    };

    // Usar changedBy (ID específico) o userIds (búsqueda por texto)
    if (changedBy) {
      logWhere.userId = changedBy;
    } else if (userIds) {
      logWhere.userId = { in: userIds };
    }

    if (startDate || endDate) {
      logWhere.createdAt = {};
      if (startDate) {
        logWhere.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        logWhere.createdAt.lte = new Date(endDate as string);
      }
    }

    // Obtener ambos tipos de eventos
    const [ticketHistory, systemLogs] = await Promise.all([
      prisma.ticketHistory.findMany({
        where: historyWhere,
        include: {
          changedByUser: {
            select: { id: true, name: true, email: true },
          },
          ticket: {
            select: { id: true, title: true, ticketNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemLog.findMany({
        where: logWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Combinar y ordenar eventos por fecha
    type CombinedEvent = {
      id: string;
      type: 'ticket_history' | 'system_log';
      action?: string;
      message?: string;
      createdAt: Date;
      changedByUser?: { id: string; name: string; email: string };
      user?: { id: string; name: string; email: string };
      ticket?: { id: string; title: string; ticketNumber: number };
      oldValue?: string;
      newValue?: string;
      metadata?: any;
    };

    const combinedEvents: CombinedEvent[] = [
      ...ticketHistory.map(h => ({
        id: h.id,
        type: 'ticket_history' as const,
        action: h.action,
        createdAt: h.createdAt,
        changedByUser: h.changedByUser,
        ticket: h.ticket || undefined,
        oldValue: h.oldValue || undefined,
        newValue: h.newValue || undefined,
      })),
      ...systemLogs.map(log => ({
        id: log.id,
        type: 'system_log' as const,
        message: log.message,
        createdAt: log.createdAt,
        user: log.user || undefined,
        metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      })),
    ];

    // Ordenar por fecha descendente
    combinedEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = combinedEvents.length;
    const totalPages = Math.ceil(total / limitNum);

    // Paginar
    const paginatedEvents = combinedEvents.slice(skip, skip + limitNum);

    res.json({
      history: paginatedEvents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error al obtener historial de cambios:', error);
    res.status(500).json({ error: 'Error al obtener el historial de cambios' });
  }
});

// GET /api/tickets/:id - Obtener un ticket específico
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true, role: true, department: true, branch: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        department: true,
        branch: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        history: {
          include: {
            changedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          where: {
            commentId: null // Solo adjuntos del ticket, no de comentarios
          },
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Verificar permisos para ver el ticket
    let canView = false;
    
    // ADMIN y AUDITOR pueden ver todos los tickets
    if (canViewAllTickets(user)) {
      canView = true;
    }
    // USER puede ver sus propios tickets
    else if (user.role === 'USER' && ticket.requestedById === user.id) {
      canView = true;
    }
    // TECHNICIAN puede ver tickets asignados a él, tickets OPEN sin asignar, O tickets creados por USER (rol inferior)
    // Como tiene los mismos permisos que ADMIN para cambiar estados, puede ver cualquier ticket que pueda gestionar
    else if (user.role === 'TECHNICIAN') {
      // Tickets asignados a él
      if (ticket.assignedToId === user.id) {
        canView = true;
      } 
      // Tickets OPEN sin asignar (para auto-asignarse)
      else if (ticket.status === 'OPEN' && !ticket.assignedToId) {
        canView = true;
      } 
      // Tickets creados por USER (rol inferior) - los técnicos pueden ver y gestionar todos los tickets de USER
      else if (ticket.requestedBy && ticket.requestedBy.role === 'USER') {
        canView = true;
      }
      // Por defecto, permitir acceso ya que técnicos tienen permisos amplios para gestionar tickets
      else {
        canView = true;
      }
    }
    // SUPERVISOR puede ver tickets de su sucursal o departamento
    else if (user.role === 'SUPERVISOR') {
      if (user.branchId && ticket.branchId === user.branchId) {
        canView = true;
      } else if (user.departmentId && ticket.departmentId === user.departmentId) {
        canView = true;
      }
    }

    if (!canView) {
      console.log('Acceso denegado al ticket:', {
        userId: user.id,
        userRole: user.role,
        ticketId: ticket.id,
        ticketRequestedBy: ticket.requestedById,
        ticketAssignedTo: ticket.assignedToId,
        ticketStatus: ticket.status,
        ticketRequestedByRole: ticket.requestedBy?.role,
        userBranchId: user.branchId,
        ticketBranchId: ticket.branchId,
        userDeptId: user.departmentId,
        ticketDeptId: ticket.departmentId,
      });
      return res.status(403).json({ error: 'No tiene permisos para ver este ticket' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error('Error al obtener ticket:', error);
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
});

// POST /api/tickets - Crear un nuevo ticket (cualquier usuario autenticado)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { title, description, priority, category, departmentId, branchId } = req.body;
    
    // Si es USER, debe usar su propia sucursal/departamento
    const finalBranchId = user.role === 'USER' ? (user.branchId || branchId) : branchId;
    const finalDepartmentId = user.role === 'USER' ? (user.departmentId || departmentId) : departmentId;

    if (!title || !description || !finalBranchId || !finalDepartmentId) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Generar número de ticket único de 6 dígitos
    const ticketNumber = await generateUniqueTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title,
        description,
        priority: priority || 'MEDIUM',
        category,
        requestedById: user.id,
        departmentId: finalDepartmentId,
        branchId: finalBranchId,
        status: 'OPEN'
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        department: true,
        branch: true
      }
    });
    
    // Crear registro en historial
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        action: 'CREATED',
        changedBy: user.id,
        newValue: 'OPEN'
      }
    });
    
    // Cargar datos completos para notificación
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        department: true,
        branch: true
      }
    });

    // Notificar creación del ticket
    if (fullTicket) {
      notifyTicketCreated(fullTicket).catch(err => {
        console.error('Error notifying ticket creation:', err);
      });
    }
    
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error al crear ticket:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
});

// PUT /api/tickets/:id - Actualizar un ticket
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { status, priority, assignedToId, resolution } = req.body;
    
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: {
          select: { id: true, role: true }
        }
      }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Verificar permisos para editar
    if (!canEditTicket(user, ticket)) {
      return res.status(403).json({ error: 'No tiene permisos para editar este ticket' });
    }

    // Verificar permisos para asignar
    if (assignedToId && !canAssignTicket(user)) {
      return res.status(403).json({ error: 'Solo los administradores pueden asignar tickets' });
    }
    
    const updateData: any = {};
    const historyEntries: any[] = [];
    
    if (status && status !== ticket.status) {
      // ADMIN y TECHNICIAN pueden cambiar el estado del ticket
      if (user.role !== 'ADMIN' && user.role !== 'TECHNICIAN') {
        return res.status(403).json({ 
          error: 'Solo el administrador y el técnico pueden cambiar el estado del ticket' 
        });
      }

      // Validar que el usuario puede hacer esta transición de estado
      const statusCheck = canChangeStatus(
        user,
        ticket.status as TicketStatus,
        status as TicketStatus,
        {
          assignedToId: ticket.assignedToId,
          requestedById: ticket.requestedById,
          requestedByRole: ticket.requestedBy?.role,
        }
      );

      if (!statusCheck.allowed) {
        return res.status(403).json({ 
          error: statusCheck.reason || 'No tiene permisos para realizar este cambio de estado' 
        });
      }

      // Si un técnico se auto-asigna un ticket OPEN, también actualizar assignedToId
      if (status === 'ASSIGNED' && ticket.status === 'OPEN' && !ticket.assignedToId && user.role === 'TECHNICIAN') {
        updateData.assignedToId = user.id;
      }

      updateData.status = status;
      historyEntries.push({
        ticketId: req.params.id,
        action: 'STATUS_CHANGED',
        oldValue: ticket.status,
        newValue: status,
        changedBy: user.id
      });
      
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date();
        updateData.resolution = resolution;
      }
    }
    
    if (priority && priority !== ticket.priority) {
      // AUDITOR no puede cambiar prioridad
      if (user.role === 'AUDITOR') {
        return res.status(403).json({ error: 'Los auditores no pueden modificar tickets (acceso de solo lectura)' });
      }
      updateData.priority = priority;
      historyEntries.push({
        ticketId: req.params.id,
        action: 'PRIORITY_CHANGED',
        oldValue: ticket.priority,
        newValue: priority,
        changedBy: user.id
      });
    }
    
    if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
      updateData.assignedToId = assignedToId;
      
      // Si se asigna un ticket y está en estado OPEN, cambiar a ASSIGNED
      if (assignedToId && ticket.status === 'OPEN') {
        updateData.status = 'ASSIGNED';
        historyEntries.push({
          ticketId: req.params.id,
          action: 'STATUS_CHANGED',
          oldValue: ticket.status,
          newValue: 'ASSIGNED',
          changedBy: user.id
        });
      }
      
      historyEntries.push({
        ticketId: req.params.id,
        action: 'ASSIGNED',
        oldValue: ticket.assignedToId || 'UNASSIGNED',
        newValue: assignedToId || 'UNASSIGNED',
        changedBy: user.id
      });
    }
    
    updateData.updatedAt = new Date();
    
    const updatedTicket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        department: true,
        branch: true
      }
    });
    
    // Crear registros de historial
    if (historyEntries.length > 0) {
      await prisma.ticketHistory.createMany({
        data: historyEntries
      });
    }

    // Obtener nombre del usuario actual
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    // Notificar cambio de estado o asignación
    const finalStatus = updatedTicket.status;
    if ((status && status !== ticket.status) || (assignedToId !== undefined && assignedToId !== ticket.assignedToId && finalStatus === 'ASSIGNED')) {
      console.log(`[Ticket Update] Notificando cambio de estado: ${ticket.status} -> ${finalStatus}`);
      console.log(`[Ticket Update] Ticket ID: ${updatedTicket.id}, Título: ${updatedTicket.title}`);
      console.log(`[Ticket Update] Solicitante ID: ${ticket.requestedById}`);
      
      // Obtener información del solicitante
      const requester = await prisma.user.findUnique({
        where: { id: ticket.requestedById },
        select: { name: true }
      });
      
      notifyTicketStatusChange({
        ticketId: updatedTicket.id,
        ticketTitle: updatedTicket.title,
        oldStatus: ticket.status,
        newStatus: finalStatus,
        changedBy: user.id,
        changedByName: currentUser?.name || user.email || 'Sistema',
        assignedToId: updatedTicket.assignedToId || undefined,
        requestedById: ticket.requestedById,
        requestedByName: requester?.name,
        comment: resolution || undefined,
        branchName: updatedTicket.branch?.name,
        departmentName: updatedTicket.department?.name,
      }).catch(err => {
        console.error('[Ticket Update] Error notificando cambio de estado:', err);
        console.error('[Ticket Update] Stack trace:', err.stack);
      });
    } else {
      console.log('[Ticket Update] No se requiere notificación (sin cambio de estado relevante)');
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
});

// POST /api/tickets/:id/comments - Agregar comentario a un ticket
router.post('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'El contenido del comentario es requerido' });
    }

    // Verificar que el ticket existe y el usuario tiene permiso para verlo
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: {
          select: { id: true, role: true }
        },
        assignedTo: {
          select: { id: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // AUDITOR no puede agregar comentarios (solo lectura)
    if (user.role === 'AUDITOR') {
      return res.status(403).json({ error: 'Los auditores no pueden agregar comentarios (acceso de solo lectura)' });
    }

    // Verificar permisos para comentar usando canAddComment
    const hasPermission = canAddComment(user, ticket);
    if (!hasPermission) {
      console.log(`[POST /tickets/:id/comments] Permisos denegados para usuario:`, {
        userId: user.id,
        userRole: user.role,
        ticketId: ticket.id,
        ticketStatus: ticket.status,
        ticketAssignedToId: ticket.assignedToId,
        ticketRequestedById: ticket.requestedById,
        requestedByRole: ticket.requestedBy?.role
      });
      return res.status(403).json({ error: 'No tiene permisos para agregar comentarios a este ticket' });
    }
    
    const comment = await prisma.comment.create({
      data: {
        content,
        ticketId: req.params.id,
        userId: user.id
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Obtener usuario completo para notificación
    const commentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true }
    });
    
    // Notificar a los involucrados sobre el nuevo comentario
    notifyCommentAdded(
      req.params.id,
      comment.id,
      content,
      {
        id: user.id,
        name: commentUser?.name || comment.user.name,
        email: comment.user.email
      }
    ).catch(err => {
      console.error('Error notifying comment addition:', err);
    });
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error al crear comentario:', error);
    res.status(500).json({ error: 'Error al crear comentario' });
  }
});

// GET /api/tickets/:id/available-statuses - Obtener estados disponibles para cambiar
// DELETE /api/tickets/:id - Eliminar un ticket (solo administrador)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    // Solo los administradores pueden eliminar tickets
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden eliminar tickets' });
    }

    // Obtener usuario completo para tener acceso a name
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true }
    });
    if (!fullUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que el ticket existe
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true }
        },
        branch: {
          select: { id: true, name: true, code: true }
        },
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Registrar la eliminación en el historial ANTES de eliminar el ticket
    // (Nota: aunque el historial se eliminará con cascade, el registro queda en logs del sistema)
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        action: 'DELETED',
        oldValue: ticket.status,
        newValue: 'DELETED',
        changedBy: user.id
      }
    }).catch(err => {
      console.error('Error al crear historial de eliminación (continuando):', err);
    });

    // Registrar también en los logs del sistema para que quede un registro permanente
    await loggerService.info(
      `Ticket #${ticket.ticketNumber} eliminado por ${fullUser.name} (${fullUser.email})`,
      'TICKET',
      {
        userId: user.id,
        ticketId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          ticketTitle: ticket.title,
          ticketStatus: ticket.status,
          requestedBy: ticket.requestedBy?.name,
          branch: ticket.branch?.name,
          department: ticket.department?.name,
          deletedBy: fullUser.name,
          deletedByEmail: fullUser.email
        }
      }
    );

    // Eliminar el ticket (esto eliminará automáticamente el historial debido a onDelete: Cascade)
    await prisma.ticket.delete({
      where: { id: req.params.id }
    });

    console.log(`[DELETE /tickets] Ticket #${ticket.ticketNumber} eliminado por ${user.email} (${user.role})`);

    res.json({ 
      message: 'Ticket eliminado exitosamente',
      ticketNumber: ticket.ticketNumber,
      deletedAt: new Date()
    });
  } catch (error) {
    console.error('Error al eliminar ticket:', error);
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
});

// GET /api/tickets/:id/available-statuses - Obtener estados disponibles para un ticket
router.get('/:id/available-statuses', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: {
          select: { id: true, role: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Verificar permisos para ver el ticket (misma lógica que GET /:id)
    let canView = false;
    
    // ADMIN y AUDITOR pueden ver todos los tickets
    if (canViewAllTickets(user)) {
      canView = true;
    }
    // USER puede ver sus propios tickets
    else if (user.role === 'USER' && ticket.requestedById === user.id) {
      canView = true;
    }
    // TECHNICIAN puede ver tickets asignados a él, tickets OPEN sin asignar, O tickets creados por USER (rol inferior)
    else if (user.role === 'TECHNICIAN') {
      if (ticket.assignedToId === user.id) {
        canView = true;
      } else if (ticket.status === 'OPEN' && !ticket.assignedToId) {
        // Permitir a técnicos ver tickets abiertos sin asignar
        canView = true;
      } else if (ticket.requestedBy && ticket.requestedBy.role === 'USER') {
        // Permitir a técnicos ver tickets creados por USER (rol inferior)
        canView = true;
      }
    }
    // SUPERVISOR puede ver tickets de su sucursal o departamento
    else if (user.role === 'SUPERVISOR') {
      if (user.branchId && ticket.branchId === user.branchId) {
        canView = true;
      } else if (user.departmentId && ticket.departmentId === user.departmentId) {
        canView = true;
      }
    }

    if (!canView) {
      console.log('[GET /available-statuses] Acceso denegado al ticket:', {
        userId: user.id,
        userRole: user.role,
        ticketId: ticket.id,
        ticketRequestedBy: ticket.requestedById,
        ticketAssignedTo: ticket.assignedToId,
        ticketStatus: ticket.status,
        ticketRequestedByRole: ticket.requestedBy?.role,
      });
      return res.status(403).json({ error: 'No tiene permisos para ver este ticket' });
    }

    const availableStatuses = getAvailableStatusTransitions(
      user,
      ticket.status as TicketStatus,
      {
        assignedToId: ticket.assignedToId,
        requestedById: ticket.requestedById,
        requestedByRole: ticket.requestedBy?.role,
      }
    );

    res.json({
      currentStatus: ticket.status,
      availableStatuses: availableStatuses.map((status: TicketStatus) => ({
        value: status,
        label: statusLabels[status],
      })),
    });
  } catch (error) {
    console.error('Error al obtener estados disponibles:', error);
    res.status(500).json({ error: 'Error al obtener estados disponibles' });
  }
});

export default router;

