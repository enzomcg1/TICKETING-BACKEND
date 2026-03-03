"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailTemplate = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const createTransporter = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;
    if (!emailUser || !emailPass) {
        return null;
    }
    const isGmail = emailUser.includes('@gmail.com');
    const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com');
    if (isGmail) {
        return nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });
    }
    if (isOutlook) {
        return nodemailer_1.default.createTransport({
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
    }
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: emailUser,
            pass: emailPass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};
const transporter = createTransporter();
const sendEmail = async ({ to, subject, html }) => {
    try {
        if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
            return false;
        }
        const emailUser = process.env.EMAIL_USER;
        if (!emailUser || !transporter) {
            console.error('[Email] EMAIL_USER/EMAIL_PASSWORD no configurados.');
            return false;
        }
        if (!to || !to.includes('@')) {
            return false;
        }
        const mailOptions = {
            from: `"Sistema de Tickets" <${emailUser}>`,
            to,
            subject,
            html,
        };
        await transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        console.error('[Email] Error al enviar email:', error?.message || error);
        return false;
    }
};
exports.sendEmail = sendEmail;
const createEmailTemplate = (type, ticketTitle, status, userName, date, link, comment, requestedByName) => {
    const statusLabels = {
        OPEN: 'Nuevo',
        ASSIGNED: 'Asignado',
        IN_PROGRESS: 'En Progreso',
        PENDING: 'En Espera',
        RESOLVED: 'Resuelto',
        CLOSED: 'Cerrado',
        CANCELLED: 'Rechazado',
    };
    const statusEmojis = {
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
exports.createEmailTemplate = createEmailTemplate;
