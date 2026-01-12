"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function testEmail() {
    console.log('🧪 Probando envío de email...\n');
    const emailUser = process.env.EMAIL_USER || 'prueba-ticket@outlook.com';
    const emailPass = process.env.EMAIL_PASSWORD || '7PF6A-WX3CQ-2L8YV-Z5QAZ-U5RYF';
    const testEmailAddress = process.env.TEST_EMAIL || 'enzogregor@outlook.com';
    console.log(`📧 Usuario SMTP: ${emailUser}`);
    console.log(`📧 Destinatario: ${testEmailAddress}\n`);
    // Detectar proveedor y probar configuraciones apropiadas
    const isGmail = emailUser.includes('@gmail.com');
    const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com');
    const configs = [];
    if (isGmail) {
        configs.push({
            name: 'Gmail (Service)',
            config: {
                service: 'gmail',
                auth: { user: emailUser, pass: emailPass },
            },
        });
    }
    else if (isOutlook) {
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
        }, {
            name: 'Outlook - Puerto 25 (Alternativo)',
            config: {
                host: 'smtp-mail.outlook.com',
                port: 25,
                secure: false,
                auth: { user: emailUser, pass: emailPass },
                tls: { rejectUnauthorized: false },
            },
        });
    }
    else {
        configs.push({
            name: 'SMTP Genérico - Puerto 587',
            config: {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                auth: { user: emailUser, pass: emailPass },
                tls: { rejectUnauthorized: false },
            },
        });
    }
    for (const { name, config } of configs) {
        console.log(`\n🔄 Probando configuración: ${name}`);
        try {
            const transporter = nodemailer_1.default.createTransport(config);
            // Verificar conexión
            await transporter.verify();
            console.log(`✅ Conexión verificada con ${name}`);
            // Intentar enviar
            const info = await transporter.sendMail({
                from: `"Sistema de Tickets" <${emailUser}>`,
                to: testEmailAddress,
                subject: `Prueba de Email - ${name}`,
                html: `
          <h2>Email de Prueba</h2>
          <p>Configuración probada: ${name}</p>
          <p>Si recibes este email, la configuración SMTP está funcionando correctamente.</p>
          <p>Fecha: ${new Date().toLocaleString('es-ES')}</p>
        `,
            });
            console.log(`✅ ✅ Email enviado exitosamente con ${name}!`);
            console.log(`   MessageId: ${info.messageId}`);
            console.log(`   Respuesta: ${info.response}`);
            process.exit(0);
        }
        catch (error) {
            console.log(`❌ Error con ${name}:`);
            console.log(`   Código: ${error.code || 'N/A'}`);
            console.log(`   Mensaje: ${error.message || 'N/A'}`);
            if (error.response) {
                console.log(`   Respuesta SMTP: ${error.response}`);
            }
        }
    }
    console.log('\n❌ Ninguna configuración funcionó. Posibles soluciones:');
    console.log('1. Genera un nuevo App Password desde https://account.microsoft.com/security');
    console.log('2. Verifica que el App Password esté correctamente copiado (sin espacios)');
    console.log('3. Considera usar Gmail u otro servicio de email');
    process.exit(1);
}
testEmail();
