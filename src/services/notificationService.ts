import prisma from '../config/database';
import { sendEmail, createEmailTemplate } from './emailService';
import { getIO } from '../config/socket';

interface NotificationData {
  ticketId: string;
  ticketTitle: string;
  oldStatus?: string;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  assignedToId?: string;
  requestedById: string;
  requestedByName?: string;
  comment?: string;
  branchName?: string;
  departmentName?: string;
}

// Obtener usuarios que deben recibir notificaciones según el estado
async function getNotificationRecipients(
  status: string,
  requestedById: string,
  assignedToId?: string,
  branchId?: string,
  departmentId?: string
) {
  const recipients: string[] = [];

  console.log(`[Notification] Determinar destinatarios para estado: ${status}`);
  
  switch (status) {
    case 'OPEN': // Nuevo
      console.log(`[Notification] OPEN - Notificando a técnicos y administradores`);
      // Notificar a todos los técnicos y administradores
      const techsAndAdmins = await prisma.user.findMany({
        where: {
          role: { in: ['TECHNICIAN', 'ADMIN'] },
          isActive: true,
        },
        select: { id: true, email: true },
      });
      recipients.push(...techsAndAdmins.map(u => u.id));
      console.log(`[Notification] OPEN - ${techsAndAdmins.length} técnicos/administradores encontrados`);
      break;

    case 'ASSIGNED': // Asignado
      console.log(`[Notification] ASSIGNED - Notificando técnico asignado y solicitante`);
      if (assignedToId) {
        recipients.push(assignedToId); // Técnico asignado
        console.log(`[Notification] ASSIGNED - Técnico asignado: ${assignedToId}`);
      }
      recipients.push(requestedById); // Solicitante
      console.log(`[Notification] ASSIGNED - Solicitante: ${requestedById}`);
      break;

    case 'IN_PROGRESS': // En progreso
      console.log(`[Notification] IN_PROGRESS - Notificando solicitante y supervisores`);
      recipients.push(requestedById); // Solicitante
      // Supervisores de la sucursal/departamento
      if (branchId || departmentId) {
        const supervisors = await prisma.user.findMany({
          where: {
            role: 'SUPERVISOR',
            OR: [
              branchId ? { branchId } : {},
              departmentId ? { departmentId } : {},
            ],
            isActive: true,
          },
          select: { id: true },
        });
        recipients.push(...supervisors.map(u => u.id));
        console.log(`[Notification] IN_PROGRESS - ${supervisors.length} supervisores encontrados`);
      }
      break;

    case 'PENDING': // En espera
      console.log(`[Notification] PENDING - Notificando solicitante y supervisores`);
      recipients.push(requestedById); // Solicitante
      if (branchId || departmentId) {
        const supervisors = await prisma.user.findMany({
          where: {
            role: 'SUPERVISOR',
            OR: [
              branchId ? { branchId } : {},
              departmentId ? { departmentId } : {},
            ],
            isActive: true,
          },
          select: { id: true },
        });
        recipients.push(...supervisors.map(u => u.id));
        console.log(`[Notification] PENDING - ${supervisors.length} supervisores encontrados`);
      }
      break;

    case 'RESOLVED': // Resuelto
      console.log(`[Notification] RESOLVED - Notificando solicitante y administradores`);
      recipients.push(requestedById); // Solicitante
      // Administradores
      const admins = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true, email: true, name: true },
      });
      recipients.push(...admins.map(u => u.id));
      console.log(`[Notification] RESOLVED - Solicitante: ${requestedById}, ${admins.length} administradores`);
      break;

    case 'CLOSED': // Cerrado
      console.log(`[Notification] CLOSED - Notificando técnico y administradores`);
      if (assignedToId) {
        recipients.push(assignedToId); // Técnico
        console.log(`[Notification] CLOSED - Técnico: ${assignedToId}`);
      }
      const adminsClosed = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true },
      });
      recipients.push(...adminsClosed.map(u => u.id));
      console.log(`[Notification] CLOSED - ${adminsClosed.length} administradores`);
      break;

    case 'CANCELLED': // Rechazado
      console.log(`[Notification] CANCELLED - Notificando solicitante y administradores`);
      recipients.push(requestedById); // Solicitante
      const adminsCancelled = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true },
      });
      recipients.push(...adminsCancelled.map(u => u.id));
      console.log(`[Notification] CANCELLED - Solicitante: ${requestedById}, ${adminsCancelled.length} administradores`);
      break;
      
    default:
      console.warn(`[Notification] ⚠️ Estado no reconocido: ${status}`);
      break;
  }
  
  console.log(`[Notification] Total destinatarios para ${status}: ${recipients.length}`);

  // Eliminar duplicados
  return [...new Set(recipients)];
}

export async function notifyTicketStatusChange(data: NotificationData) {
  try {
    const { ticketId, ticketTitle, newStatus, changedBy, changedByName, assignedToId, requestedById, requestedByName, comment, branchName, departmentName } = data;

    console.log(`[Notification] Iniciando notificación para ticket ${ticketId}, estado: ${newStatus}`);
    console.log(`[Notification] Cambiado por: ${changedByName} (${changedBy})`);
    console.log(`[Notification] Solicitante ID: ${requestedById}`);

    // Obtener información del ticket para obtener branchId y departmentId
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        branchId: true,
        departmentId: true,
      },
    });

    // Obtener usuarios que deben recibir notificaciones
    const recipientIds = await getNotificationRecipients(
      newStatus,
      requestedById,
      assignedToId,
      ticket?.branchId || undefined,
      ticket?.departmentId || undefined
    );

    console.log(`[Notification] IDs de destinatarios obtenidos para estado ${newStatus}:`, recipientIds);

    if (recipientIds.length === 0) {
      console.warn(`[Notification] No se encontraron destinatarios para el estado ${newStatus}`);
      return;
    }

    // Obtener información completa de los usuarios
    const recipients = await prisma.user.findMany({
      where: {
        id: { in: recipientIds },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log(`[Notification] Estado: ${newStatus}, Destinatarios encontrados: ${recipients.length}`);
    recipients.forEach(r => {
      console.log(`  - ${r.name} (${r.id}): ${r.email || '❌ SIN EMAIL'}`);
    });

    // Obtener información del solicitante si no se proporcionó
    let finalRequestedByName = requestedByName;
    if (!finalRequestedByName) {
      const requesterUser = await prisma.user.findUnique({
        where: { id: requestedById },
        select: { name: true, email: true }
      });
      if (requesterUser) {
        finalRequestedByName = requesterUser.name;
        console.log(`[Notification] Solicitante encontrado: ${requesterUser.name}, Email: ${requesterUser.email || 'NO CONFIGURADO'}`);
        if (!requesterUser.email || !requesterUser.email.includes('@')) {
          console.warn(`[Notification] ⚠️ El solicitante ${requesterUser.name} no tiene un email válido configurado!`);
        }
      } else {
        console.warn(`[Notification] ⚠️ No se encontró al solicitante (ID: ${requestedById}) en la base de datos!`);
      }
    }

    const statusLabels: Record<string, string> = {
      OPEN: 'Nuevo',
      ASSIGNED: 'Asignado',
      IN_PROGRESS: 'En Progreso',
      PENDING: 'En Espera',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado',
      CANCELLED: 'Rechazado',
    };

    const statusMessages: Record<string, string> = {
      OPEN: '🆕 Nuevo ticket creado',
      ASSIGNED: '🎯 Ticket asignado',
      IN_PROGRESS: '🔧 Ticket en progreso',
      PENDING: '⏸️ Ticket en espera',
      RESOLVED: '✅ Ticket resuelto',
      CLOSED: '🏁 Ticket cerrado',
      CANCELLED: '❌ Ticket rechazado',
    };

    const date = new Date().toLocaleString('es-ES');
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets/${ticketId}`;
    const statusLabel = statusLabels[newStatus] || newStatus;
    const statusMessage = statusMessages[newStatus] || `Estado: ${statusLabel}`;

    // Crear notificaciones en base de datos y enviar
    const notifications = await Promise.all(
      recipients.map(async (recipient) => {
        // Notificación WebSocket
        if (process.env.ENABLE_SOCKET_NOTIFICATIONS !== 'false') {
          const io = getIO();
          io.to(`user-${recipient.id}`).emit('ticket-notification', {
            userId: recipient.id,
            ticketId,
            ticketTitle,
            status: newStatus,
            statusLabel,
            statusMessage,
            changedBy: changedByName,
            date,
            comment,
            link,
          });
        }

        // Notificación Email - Funciona para TODOS los estados: OPEN, ASSIGNED, IN_PROGRESS, PENDING, RESOLVED, CLOSED, CANCELLED
        let emailSent = false;
        if (recipient.email && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
          console.log(`[Notification] 📧 Enviando email a ${recipient.email} para ticket ${ticketId}`);
          console.log(`[Notification] 📧 Estado del ticket: ${newStatus} (${statusLabel})`);
          try {
            const emailHtml = createEmailTemplate(
              'TICKET_STATUS_CHANGED',
              ticketTitle,
              newStatus,
              changedByName,
              date,
              link,
              comment,
              finalRequestedByName
            );
            emailSent = await sendEmail({
              to: recipient.email,
              subject: `${statusLabel}: ${ticketTitle}`,
              html: emailHtml,
            });
            if (emailSent) {
              console.log(`[Notification] ✅ Email enviado exitosamente a ${recipient.email} para estado ${newStatus}`);
            } else {
              console.warn(`[Notification] ⚠️ No se pudo enviar email a ${recipient.email} para estado ${newStatus}`);
            }
          } catch (emailError) {
            console.error(`[Notification] ❌ Error al enviar email a ${recipient.email} para estado ${newStatus}:`, emailError);
          }
        } else {
          if (!recipient.email) {
            console.warn(`[Notification] ⚠️ Usuario ${recipient.id} (${recipient.name}) no tiene email configurado`);
          } else if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
            console.log(`[Notification] ℹ️ Notificaciones de email deshabilitadas (ENABLE_EMAIL_NOTIFICATIONS != 'true')`);
          }
        }

        // Guardar en base de datos
        return prisma.notification.create({
          data: {
            ticketId,
            userId: recipient.id,
            type: 'TICKET_STATUS_CHANGED',
            channel: emailSent ? 'EMAIL' : 'WEBSOCKET',
            title: `${statusMessage}: ${ticketTitle}`,
            message: `El ticket "${ticketTitle}" cambió a estado ${statusLabel} por ${changedByName}${comment ? `. Comentario: ${comment}` : ''}`,
            isRead: false,
          },
        });
      })
    );

    console.log(`Notifications sent to ${notifications.length} users`);
    return notifications;
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
}

export async function notifyTicketCreated(ticket: any) {
  try {
    // Obtener técnicos y administradores
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: ['TECHNICIAN', 'ADMIN'] },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const date = new Date().toLocaleString('es-ES');
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets/${ticket.id}`;

    await Promise.all(
      recipients.map(async (recipient) => {
        // WebSocket
        if (process.env.ENABLE_SOCKET_NOTIFICATIONS !== 'false') {
          const io = getIO();
          io.to(`user-${recipient.id}`).emit('ticket-notification', {
            userId: recipient.id,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            status: 'OPEN',
            statusLabel: 'Nuevo',
            statusMessage: '🆕 Nuevo ticket creado',
            changedBy: ticket.requestedBy?.name || 'Sistema',
            date,
            link,
          });
        }

        // Email - Notificación de creación de ticket
        let emailSent = false;
        if (recipient.email && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
          console.log(`[Notification] 📧 Enviando email de CREACIÓN de ticket a ${recipient.email}`);
          try {
            const emailHtml = createEmailTemplate(
              'TICKET_CREATED',
              ticket.title,
              'OPEN',
              ticket.requestedBy?.name || 'Sistema',
              date,
              link,
              undefined,
              ticket.requestedBy?.name || 'Sistema'
            );
            emailSent = await sendEmail({
              to: recipient.email,
              subject: `🆕 Nuevo ticket: ${ticket.title}`,
              html: emailHtml,
            });
            if (emailSent) {
              console.log(`[Notification] ✅ Email de creación enviado exitosamente a ${recipient.email}`);
            } else {
              console.warn(`[Notification] ⚠️ No se pudo enviar email de creación a ${recipient.email}`);
            }
          } catch (emailError) {
            console.error(`[Notification] ❌ Error al enviar email de creación a ${recipient.email}:`, emailError);
          }
        } else {
          if (!recipient.email) {
            console.warn(`[Notification] ⚠️ Usuario ${recipient.id} (${recipient.name}) no tiene email configurado`);
          } else if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
            console.log(`[Notification] ℹ️ Notificaciones de email deshabilitadas`);
          }
        }

        // Guardar en BD
        return prisma.notification.create({
          data: {
            ticketId: ticket.id,
            userId: recipient.id,
            type: 'TICKET_CREATED',
            channel: emailSent ? 'EMAIL' : 'WEBSOCKET',
            title: `🆕 Nuevo ticket: ${ticket.title}`,
            message: `Se creó un nuevo ticket "${ticket.title}" en ${ticket.branch?.name || 'N/A'} - ${ticket.department?.name || 'N/A'}`,
            isRead: false,
          },
        });
      })
    );
  } catch (error) {
    console.error('Error notifying ticket creation:', error);
  }
}

export async function notifyCommentAdded(
  ticketId: string,
  commentId: string,
  commentContent: string,
  commentedBy: { id: string; name: string; email?: string }
) {
  try {
    console.log(`[Notification] Iniciando notificación de comentario agregado en ticket ${ticketId}`);
    console.log(`[Notification] Comentado por: ${commentedBy.name} (${commentedBy.id})`);

    // Obtener información completa del ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requestedBy: {
          select: { id: true, email: true, name: true }
        },
        assignedTo: {
          select: { id: true, email: true, name: true }
        },
        branch: {
          select: { id: true, name: true }
        },
        department: {
          select: { id: true, name: true }
        }
      }
    });

    if (!ticket) {
      console.warn(`[Notification] ⚠️ Ticket ${ticketId} no encontrado`);
      return;
    }

    // Determinar destinatarios: solicitante, técnico asignado, supervisores, y administradores
    const recipientIds: string[] = [];

    // 1. Solicitante (siempre debe ser notificado, excepto si es quien comentó)
    if (ticket.requestedById && ticket.requestedById !== commentedBy.id) {
      recipientIds.push(ticket.requestedById);
      console.log(`[Notification] Agregado solicitante: ${ticket.requestedBy?.name}`);
    }

    // 2. Técnico asignado (si existe y no es quien comentó)
    if (ticket.assignedToId && ticket.assignedToId !== commentedBy.id) {
      recipientIds.push(ticket.assignedToId);
      console.log(`[Notification] Agregado técnico asignado: ${ticket.assignedTo?.name}`);
    }

    // 3. Supervisores de la sucursal/departamento (si hay)
    if (ticket.branchId || ticket.departmentId) {
      const supervisors = await prisma.user.findMany({
        where: {
          role: 'SUPERVISOR',
          OR: [
            ticket.branchId ? { branchId: ticket.branchId } : {},
            ticket.departmentId ? { departmentId: ticket.departmentId } : {},
          ],
          isActive: true,
          id: { not: commentedBy.id } // Excluir a quien comentó
        },
        select: { id: true, name: true, email: true }
      });
      supervisors.forEach(s => {
        recipientIds.push(s.id);
        console.log(`[Notification] Agregado supervisor: ${s.name}`);
      });
    }

    // 4. Administradores (opcional, pero útil para estar al tanto)
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
        id: { not: commentedBy.id } // Excluir a quien comentó
      },
      select: { id: true, name: true, email: true }
    });
    admins.forEach(a => {
      recipientIds.push(a.id);
      console.log(`[Notification] Agregado administrador: ${a.name}`);
    });

    // Eliminar duplicados
    const uniqueRecipientIds = [...new Set(recipientIds)];

    if (uniqueRecipientIds.length === 0) {
      console.log(`[Notification] No hay destinatarios para notificar (todos ya fueron excluidos)`);
      return;
    }

    console.log(`[Notification] Total destinatarios: ${uniqueRecipientIds.length}`);

    // Obtener información completa de los destinatarios
    const recipients = await prisma.user.findMany({
      where: {
        id: { in: uniqueRecipientIds },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const date = new Date().toLocaleString('es-ES');
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets/${ticketId}`;

    // Crear notificaciones y enviar emails
    await Promise.all(
      recipients.map(async (recipient) => {
        // WebSocket
        if (process.env.ENABLE_SOCKET_NOTIFICATIONS !== 'false') {
          const io = getIO();
          io.to(`user-${recipient.id}`).emit('ticket-notification', {
            userId: recipient.id,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            status: ticket.status,
            statusLabel: ticket.status,
            statusMessage: `💬 Nuevo comentario en ticket`,
            changedBy: commentedBy.name,
            date,
            comment: commentContent,
            link,
          });
        }

        // Email
        let emailSent = false;
        if (recipient.email && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
          console.log(`[Notification] 📧 Enviando email de COMENTARIO a ${recipient.email}`);
          try {
            // Usar el template existente pero con el contenido del comentario
            const emailHtml = createEmailTemplate(
              'TICKET_COMMENT_ADDED',
              ticket.title,
              ticket.status,
              commentedBy.name,
              date,
              link,
              commentContent, // Pasar el contenido del comentario
              ticket.requestedBy?.name
            );
            emailSent = await sendEmail({
              to: recipient.email,
              subject: `💬 Nuevo comentario en ticket: ${ticket.title}`,
              html: emailHtml,
            });
            if (emailSent) {
              console.log(`[Notification] ✅ Email de comentario enviado exitosamente a ${recipient.email}`);
            } else {
              console.warn(`[Notification] ⚠️ No se pudo enviar email de comentario a ${recipient.email}`);
            }
          } catch (emailError) {
            console.error(`[Notification] ❌ Error al enviar email de comentario a ${recipient.email}:`, emailError);
          }
        } else {
          if (!recipient.email) {
            console.warn(`[Notification] ⚠️ Usuario ${recipient.id} (${recipient.name}) no tiene email configurado`);
          }
        }

        // Guardar en BD
        return prisma.notification.create({
          data: {
            ticketId: ticket.id,
            userId: recipient.id,
            type: 'TICKET_COMMENT_ADDED',
            channel: emailSent ? 'EMAIL' : 'WEBSOCKET',
            title: `💬 Nuevo comentario en ticket: ${ticket.title}`,
            message: `${commentedBy.name} agregó un comentario: "${commentContent.substring(0, 100)}${commentContent.length > 100 ? '...' : ''}"`,
            isRead: false,
          },
        });
      })
    );

    console.log(`[Notification] Notificaciones de comentario enviadas a ${recipients.length} usuarios`);
  } catch (error) {
    console.error('Error notifying comment addition:', error);
  }
}

