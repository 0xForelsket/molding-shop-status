// packages/api/src/middleware/auth.ts

import type { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

const ESP32_API_KEY = process.env.ESP32_API_KEY || 'dev-esp32-key';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod';

// Middleware for ESP32 status reports (API key auth)
export async function esp32Auth(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey || apiKey !== ESP32_API_KEY) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }

  await next();
}

// Middleware for dashboard users (JWT auth)
export async function jwtAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verify(token, JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// Role-based access control
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as { role?: string } | undefined;

    if (!user || !user.role || !roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    await next();
  };
}

// Helper to sign JWT tokens
export async function signToken(payload: Record<string, unknown>): Promise<string> {
  return sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    JWT_SECRET
  );
}
