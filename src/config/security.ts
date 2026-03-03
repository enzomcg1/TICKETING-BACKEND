const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return isProduction() ? [] : DEV_ORIGINS;
}

export function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.includes(origin);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no configurado o demasiado corto. Debe tener al menos 32 caracteres.');
  }
  return secret;
}
