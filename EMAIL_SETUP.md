# Configuración de Email - Solución de Problemas

## ❌ Error Actual: "Authentication unsuccessful, basic authentication is disabled"

Este error indica que Outlook ha deshabilitado la autenticación básica. Para resolverlo, necesitas usar un **App Password** en lugar de la contraseña normal de tu cuenta.

## 🔧 Solución: Generar un App Password

### Paso 1: Habilitar Autenticación de Dos Factores (2FA)

1. Ve a https://account.microsoft.com/security
2. Inicia sesión con tu cuenta de Outlook (`prueba-ticket@outlook.com`)
3. Ve a **Seguridad** → **Autenticación de dos factores**
4. Habilita la verificación en dos pasos si no está activada

### Paso 2: Generar App Password

1. En la misma página de seguridad, busca **"Contraseñas de aplicación"** o **"App passwords"**
2. Si no aparece directamente, busca en **"Métodos de verificación"** o **"Verificación en dos pasos"**
3. Genera una nueva contraseña de aplicación
4. **Copia el App Password generado** (tendrá formato similar a: `XXXX-XXXX-XXXX-XXXX`)

### Paso 3: Actualizar el archivo .env

Edita el archivo `backend/.env` y actualiza:

```env
EMAIL_USER=prueba-ticket@outlook.com
EMAIL_PASSWORD=TU_NUEVO_APP_PASSWORD_AQUI
ENABLE_EMAIL_NOTIFICATIONS=true
```

### Paso 4: Reiniciar el servidor

Después de actualizar el `.env`, reinicia el servidor backend.

## 🧪 Probar la Configuración

Ejecuta el script de prueba:

```bash
cd backend
npm run test:email
```

Este script intentará enviar un email de prueba y mostrará si hay errores.

## ⚠️ Notas Importantes

1. **No uses la contraseña normal** de tu cuenta, solo App Passwords funcionan ahora
2. **Cada App Password es único** - si generas uno nuevo, el anterior dejará de funcionar
3. **Los App Passwords no tienen espacios** - si el generado tiene formato `XXXX-XXXX-XXXX-XXXX`, úsalo tal cual
4. Si no tienes acceso a generar App Passwords, es posible que tu cuenta no tenga 2FA habilitado

## 🔄 Alternativas

Si no puedes usar App Passwords, considera:

1. **Usar otro servicio de email**: Gmail (con App Password), SendGrid, Mailgun, etc.
2. **OAuth2**: Más complejo pero más seguro (requiere configuración adicional)

## 📧 Configuración para Gmail (Alternativa)

Si prefieres usar Gmail:

```env
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password-gmail
# Y actualizar en emailService.ts:
host: 'smtp.gmail.com',
port: 587,
```

Para Gmail también necesitas un App Password generado desde https://myaccount.google.com/apppasswords






