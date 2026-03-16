const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];
const PROD_FALLBACK_ORIGINS = ['https://ticketing-frontend-blush-omega.vercel.app'];
const PROD_FALLBACK_ORIGIN_PATTERNS = ['https://*.vercel.app'];

function readEnvList(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAllowedOrigins(): string[] {
  const fromEnv = readEnvList('FRONTEND_URL');

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return isProduction() ? PROD_FALLBACK_ORIGINS : DEV_ORIGINS;
}

export function getAllowedOriginPatterns(): string[] {
  const fromEnv = readEnvList('FRONTEND_ORIGIN_PATTERNS');

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return isProduction() ? PROD_FALLBACK_ORIGIN_PATTERNS : [];
}

export function hasConfiguredAllowedOrigins(): boolean {
  return getAllowedOrigins().length > 0 || getAllowedOriginPatterns().length > 0;
}

function matchesOriginPattern(origin: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return origin === pattern;
  }

  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escapedPattern}$`).test(origin);
}

export function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  const allowedPatterns = getAllowedOriginPatterns();

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedPatterns.some((pattern) => matchesOriginPattern(origin, pattern));
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no configurado o demasiado corto. Debe tener al menos 32 caracteres.');
  }
  return secret;
}
