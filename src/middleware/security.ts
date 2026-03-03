import { NextFunction, Request, Response } from 'express';

type AttemptsRecord = {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
};

const loginAttempts = new Map<string, AttemptsRecord>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 10;
const BLOCK_MS = 15 * 60 * 1000; // 15 minutos
const MAX_TRACKED_KEYS = 5000;

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'unknown';
  const key = `${getClientIp(req)}:${email}`;
  if (loginAttempts.size > MAX_TRACKED_KEYS) {
    for (const [trackedKey, value] of loginAttempts.entries()) {
      if (now - value.firstAttemptAt > WINDOW_MS && (!value.blockedUntil || value.blockedUntil <= now)) {
        loginAttempts.delete(trackedKey);
      }
    }
  }
  const current = loginAttempts.get(key);

  if (!current) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return next();
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((current.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({ error: 'Demasiados intentos. Intente nuevamente más tarde.' });
    return;
  }

  if (now - current.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return next();
  }

  current.count += 1;
  if (current.count > MAX_ATTEMPTS) {
    current.blockedUntil = now + BLOCK_MS;
    res.setHeader('Retry-After', Math.ceil(BLOCK_MS / 1000).toString());
    res.status(429).json({ error: 'Demasiados intentos. Intente nuevamente más tarde.' });
    return;
  }

  loginAttempts.set(key, current);
  next();
}

export function clearLoginRateLimit(req: Request): void {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'unknown';
  const key = `${getClientIp(req)}:${email}`;
  loginAttempts.delete(key);
}
