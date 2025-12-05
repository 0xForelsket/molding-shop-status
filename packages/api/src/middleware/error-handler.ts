// packages/api/src/middleware/error-handler.ts

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export function errorHandler(err: Error, c: Context) {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      400
    );
  }

  // HTTP exceptions (thrown intentionally)
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  // Database errors
  if (err.message?.includes('duplicate key')) {
    return c.json({ error: 'Resource already exists' }, 409);
  }

  if (err.message?.includes('violates foreign key')) {
    return c.json({ error: 'Referenced resource not found' }, 400);
  }

  // Unknown errors - don't leak details in production
  const isDev = process.env.NODE_ENV !== 'production';
  return c.json(
    {
      error: 'Internal server error',
      ...(isDev && { message: err.message, stack: err.stack }),
    },
    500
  );
}
