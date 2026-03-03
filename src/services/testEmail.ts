import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('Probando envio de email...');

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  const testEmailAddress = process.env.TEST_EMAIL;

  if (!emailUser || !emailPass || !testEmailAddress) {
    console.error('Faltan variables requeridas: EMAIL_USER, EMAIL_PASSWORD y TEST_EMAIL');
    process.exit(1);
  }

  const isGmail = emailUser.includes('@gmail.com');
  const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com');

  const configs = [] as Array<{ name: string; config: any }>;

  if (isGmail) {
    configs.push({
      name: 'Gmail (Service)',
      config: {
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
      },
    });
  } else if (isOutlook) {
    configs.push({
      name: 'Outlook - Puerto 587 (STARTTLS)',
      config: {
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        auth: { user: emailUser, pass: emailPass },
        tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
        requireTLS: true,
      },
    });
  } else {
    configs.push({
      name: 'SMTP Generico',
      config: {
        host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: emailUser, pass: emailPass },
        tls: { rejectUnauthorized: false },
      },
    });
  }

  for (const { name, config } of configs) {
    try {
      const transporter = nodemailer.createTransport(config);
      await transporter.verify();

      const info = await transporter.sendMail({
        from: `"Sistema de Tickets" <${emailUser}>`,
        to: testEmailAddress,
        subject: `Prueba de Email - ${name}`,
        html: `<h2>Email de Prueba</h2><p>Configuracion: ${name}</p><p>Fecha: ${new Date().toISOString()}</p>`,
      });

      console.log(`Email enviado exitosamente con ${name}. MessageId: ${info.messageId}`);
      process.exit(0);
    } catch (error: any) {
      console.error(`Error con ${name}:`, error?.message || error);
    }
  }

  process.exit(1);
}

testEmail();
