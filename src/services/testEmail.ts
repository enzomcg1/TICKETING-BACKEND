import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('Probando envio de email...');

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  const testEmailAddress = process.env.TEST_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = (process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
  const fromName = process.env.SMTP_FROM_NAME || 'Sistema de Tickets';
  const fromEmail = process.env.SMTP_FROM_EMAIL || emailUser;

  if (!smtpHost || !emailUser || !emailPass || !testEmailAddress || !fromEmail) {
    console.error('Faltan variables requeridas: SMTP_HOST, EMAIL_USER, EMAIL_PASSWORD, SMTP_FROM_EMAIL y TEST_EMAIL');
    process.exit(1);
  }

  try {
    const transportConfig: SMTPTransport.Options & { family: 4 } = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: !smtpSecure,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      family: 4,
      auth: { user: emailUser, pass: emailPass },
    };

    const transporter = nodemailer.createTransport(transportConfig);

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: testEmailAddress,
      subject: 'Prueba de Email - Sistema de Tickets',
      html: `<h2>Email de Prueba</h2><p>Servidor SMTP: ${smtpHost}:${smtpPort}</p><p>Fecha: ${new Date().toISOString()}</p>`,
    });

    console.log(`Email enviado exitosamente. MessageId: ${info.messageId}`);
    process.exit(0);
  } catch (error: any) {
    console.error('Error SMTP:', error?.message || error);
    process.exit(1);
  }
}

testEmail();
