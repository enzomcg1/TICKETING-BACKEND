# Configuración de Email - Guía Completa

## ⚠️ Problema con Outlook

Microsoft ha deshabilitado la autenticación básica para muchas cuentas de Outlook.com, incluso con App Passwords válidos. Esto requiere implementar OAuth2, que es complejo.

## ✅ Solución Recomendada: Gmail

Gmail funciona mejor y es más confiable para este tipo de aplicaciones.

### Pasos para configurar Gmail:

1. **Crear o usar una cuenta Gmail**
   - Puedes usar una cuenta personal o crear una nueva: `tickets.sistema@gmail.com`

2. **Habilitar Autenticación de Dos Factores**
   - Ve a: https://myaccount.google.com/security
   - Activa "Verificación en dos pasos"

3. **Generar App Password**
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Correo" y "Otro (nombre personalizado)"
   - Ingresa "Sistema de Tickets"
   - Copia el App Password generado (formato: `xxxx xxxx xxxx xxxx` - úsalo sin espacios)

4. **Actualizar `.env`**:
   ```env
   EMAIL_USER=tu-email@gmail.com
   EMAIL_PASSWORD=xxxxx xxxx xxxx xxxx
   ENABLE_EMAIL_NOTIFICATIONS=true
   ```

5. **El sistema detectará automáticamente que es Gmail** y usará la configuración correcta

## 📧 El sistema ahora soporta:

- ✅ **Gmail**: Detección automática y configuración optimizada
- ⚠️ **Outlook**: Intenta funcionar pero puede requerir OAuth2
- ✅ **Otros servicios**: Configuración SMTP genérica

## 🧪 Probar la configuración:

```bash
cd backend
npm run test:email
```






