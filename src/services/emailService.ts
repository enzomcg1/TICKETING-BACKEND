import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

function isEnabled(value: string | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = isEnabled(process.env.SMTP_SECURE);
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = process.env.EMAIL_PASSWORD || '';
  const fromName = (process.env.SMTP_FROM_NAME || 'Sistema de Tickets').trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();

  if (!host || !user || !pass || !fromEmail) {
    return null;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

const createTransporter = () => {
  const config = getEmailConfig();

  if (!config) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
};

let transporter: nodemailer.Transporter | null | undefined;
let transporterVerified = false;

export function isEmailEnabled(): boolean {
  return isEnabled(process.env.ENABLE_EMAIL_NOTIFICATIONS);
}

function getTransporter(): nodemailer.Transporter | null {
  if (transporter === undefined) {
    transporter = createTransporter();
  }
  return transporter;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface NotificationEmailTemplateOptions {
  title: string;
  intro: string;
  details?: Array<{ label: string; value: string }>;
  actionLabel?: string;
  actionUrl?: string;
  footer?: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions): Promise<boolean> => {
  try {
    if (!isEmailEnabled()) {
      console.warn('[Email] Notificaciones de email deshabilitadas por configuracion.');
      return false;
    }

    const emailConfig = getEmailConfig();
    const activeTransporter = getTransporter();
    if (!emailConfig || !activeTransporter) {
      console.error('[Email] Configuracion SMTP incompleta. Requiere SMTP_HOST, SMTP_PORT, EMAIL_USER y EMAIL_PASSWORD.');
      return false;
    }

    if (!to || !to.includes('@')) {
      return false;
    }

    const mailOptions = {
      from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
      to,
      subject,
      html,
    };

    if (!transporterVerified) {
      await activeTransporter.verify();
      transporterVerified = true;
    }

    await activeTransporter.sendMail(mailOptions);
    return true;
  } catch (error: any) {
    console.error('[Email] Error al enviar email:', error?.message || error);
    transporterVerified = false;
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
    OPEN: 'Nuevo',
    ASSIGNED: 'Asignado',
    IN_PROGRESS: 'En progreso',
    PENDING: 'En espera',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
    CANCELLED: 'Rechazado',
  };

  const safeTicketTitle = escapeHtml(ticketTitle || 'Ticket');
  const safeStatus = escapeHtml(statusLabels[status] || status);
  const safeUserName = escapeHtml(userName || 'Sistema');
  const safeDate = escapeHtml(date || '');
  const safeLink = escapeHtml(link || '#');
  const safeComment = comment ? escapeHtml(comment) : '';
  const safeRequestedByName = requestedByName ? escapeHtml(requestedByName) : '';

  const isComment = type === 'TICKET_COMMENT_ADDED';
  const emoji = isComment ? 'Comentario' : (statusEmojis[status] || 'Ticket');
  const title = isComment ? `Nuevo comentario: ${safeTicketTitle}` : `${safeStatus}: ${safeTicketTitle}`;

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
            ${!isComment ? `<p><strong>Estado actual:</strong> ${safeStatus}</p>` : ''}
            <p><strong>Fecha y hora:</strong> ${safeDate}</p>
            <p><strong>Usuario responsable:</strong> ${safeUserName}</p>
            ${safeRequestedByName ? `<p><strong>Usuario solicitante:</strong> ${safeRequestedByName}</p>` : ''}
          </div>
          ${safeComment ? `
          <div class="comment-box">
            <p><strong>Comentario:</strong></p>
            <p class="comment-text">${safeComment}</p>
          </div>
          ` : ''}
          <a href="${safeLink}" class="button">Ver Ticket</a>
          <div class="footer">
            <p>Sistema de Gestion de Tickets - Departamento de Informatica</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createNotificationEmailTemplate = ({
  title,
  intro,
  details = [],
  actionLabel,
  actionUrl,
  footer,
}: NotificationEmailTemplateOptions): string => {
  const safeTitle = escapeHtml(title || 'Notificacion');
  const safeIntro = escapeHtml(intro || '');
  const safeFooter = escapeHtml(footer || 'Sistema de Gestion de Tickets - Departamento de Informatica');
  const safeDetails = details
    .filter((detail) => detail.label && detail.value)
    .map((detail) => ({
      label: escapeHtml(detail.label),
      value: escapeHtml(detail.value),
    }));
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : '';
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; margin: 0; padding: 24px; }
        .container { max-width: 640px; margin: 0 auto; }
        .card { background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); }
        .header { background: #1d4ed8; color: #ffffff; padding: 24px; }
        .content { padding: 24px; }
        .intro { margin: 0 0 20px; }
        .details { width: 100%; border-collapse: collapse; margin: 16px 0 24px; }
        .details td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        .details td:first-child { width: 180px; font-weight: 700; color: #374151; }
        .button { display: inline-block; padding: 12px 20px; background: #1d4ed8; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 700; }
        .footer { padding: 0 24px 24px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h2>${safeTitle}</h2>
          </div>
          <div class="content">
            <p class="intro">${safeIntro}</p>
            ${safeDetails.length > 0 ? `
            <table class="details">
              <tbody>
                ${safeDetails.map((detail) => `
                <tr>
                  <td>${detail.label}</td>
                  <td>${detail.value}</td>
                </tr>`).join('')}
              </tbody>
            </table>` : ''}
            ${safeActionLabel && safeActionUrl ? `<a href="${safeActionUrl}" class="button">${safeActionLabel}</a>` : ''}
          </div>
          <div class="footer">
            <p>${safeFooter}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
