import nodemailer from 'nodemailer';
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
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: emailUser, pass: emailPass },
    });

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
