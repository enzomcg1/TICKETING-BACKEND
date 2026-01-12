import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configurar transporte de email
// Soporta Outlook y Gmail automáticamente según el dominio del email
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER || 'prueba-ticket@outlook.com';
  const emailPass = process.env.EMAIL_PASSWORD || '';
  
  console.log('[Email] Configurando transporte SMTP para:', emailUser);
  
  // Detectar el proveedor según el dominio del email
  const isGmail = emailUser.includes('@gmail.com');
  const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com');
  
  if (isGmail) {
    // Configuración para Gmail
    console.log('[Email] Detectado Gmail, usando configuración SMTP de Gmail');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  } else if (isOutlook) {
    // Configuración para Outlook/Hotmail
    console.log('[Email] Detectado Outlook, usando configuración SMTP de Outlook');
    console.log('[Email] ⚠️ NOTA: Outlook ha deshabilitado autenticación básica en muchas cuentas.');
    console.log('[Email] Si falla, considera usar Gmail o un servicio de terceros.');
    
    return nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
      requireTLS: true,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });
  } else {
    // Configuración genérica SMTP
    console.log('[Email] Usando configuración SMTP genérica');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
};

const transporter = createTransporter();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions): Promise<boolean> => {
  try {
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
      console.log('[Email] Notificaciones de email deshabilitadas, omitiendo envío...');
      return false;
    }

    if (!to || !to.includes('@')) {
      console.error('[Email] Email inválido:', to);
      return false;
    }

    const mailOptions = {
      from: `"Sistema de Tickets" <${process.env.EMAIL_USER || 'prueba-ticket@outlook.com'}>`,
      to,
      subject,
      html,
    };

    console.log('[Email] Intentando enviar email a:', to);
    console.log('[Email] Asunto:', subject);
    console.log('[Email] Usuario SMTP:', process.env.EMAIL_USER || 'prueba-ticket@outlook.com');
    
    // Intentar enviar directamente (verificar puede fallar incluso cuando el envío funciona)
    // No verificamos la conexión aquí para evitar falsos negativos

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] ✅ Email enviado exitosamente. MessageId:', info.messageId);
    console.log('[Email] Respuesta del servidor:', info.response);
    return true;
  } catch (error: any) {
    console.error('[Email] ❌ Error al enviar email:', error);
    console.error('[Email] Código de error:', error.code);
    console.error('[Email] Mensaje de error:', error.message);
    if (error.response) {
      console.error('[Email] Respuesta del servidor SMTP:', error.response);
    }
    if (error.code === 'EAUTH') {
      console.error('[Email] ⚠️ Error de autenticación. Posibles causas:');
      console.error('[Email]   1. El App Password puede haber expirado o ser incorrecto');
      console.error('[Email]   2. Outlook puede haber deshabilitado la autenticación básica');
      console.error('[Email]   3. Necesitas generar un nuevo App Password desde https://account.microsoft.com/security');
      console.error('[Email]   4. Verifica que el email sea: ', process.env.EMAIL_USER || 'prueba-ticket@outlook.com');
    }
    return false;
  }
};

export const createEmailTemplate = (
  type: string,
  ticketTitle: string,
  status: string,
  userName: string,
  date: string,
  link: string,
  comment?: string,
  requestedByName?: string
): string => {
  const statusLabels: Record<string, string> = {
    OPEN: 'Nuevo',
    ASSIGNED: 'Asignado',
    IN_PROGRESS: 'En Progreso',
    PENDING: 'En Espera',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
    CANCELLED: 'Rechazado',
  };

  const statusEmojis: Record<string, string> = {
    OPEN: '🆕',
    ASSIGNED: '🎯',
    IN_PROGRESS: '🔧',
    PENDING: '⏸️',
    RESOLVED: '✅',
    CLOSED: '🏁',
    CANCELLED: '❌',
  };

  // Si es un comentario, usar emoji de comentario
  const isComment = type === 'TICKET_COMMENT_ADDED';
  const emoji = isComment ? '💬' : (statusEmojis[status] || '📋');
  const statusLabel = statusLabels[status] || status;
  const title = isComment ? `Nuevo comentario: ${ticketTitle}` : `${statusLabel}: ${ticketTitle}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .ticket-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2563eb; }
        .comment-box { background: #f0f9ff; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #3b82f6; }
        .comment-text { font-style: italic; color: #1e40af; white-space: pre-wrap; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${emoji} ${title}</h2>
        </div>
        <div class="content">
          <div class="ticket-info">
            ${!isComment ? `<p><strong>Estado actual:</strong> ${statusLabel}</p>` : ''}
            <p><strong>Fecha y hora:</strong> ${date}</p>
            <p><strong>Usuario responsable:</strong> ${userName}</p>
            ${requestedByName ? `<p><strong>Usuario solicitante:</strong> ${requestedByName}</p>` : ''}
          </div>
          ${comment ? `
          <div class="comment-box">
            <p><strong>💬 Comentario:</strong></p>
            <p class="comment-text">${comment}</p>
          </div>
          ` : ''}
          <a href="${link}" class="button">Ver Ticket</a>
          <div class="footer">
            <p>Sistema de Gestión de Tickets - Departamento de Informática</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

