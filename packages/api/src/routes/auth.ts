// packages/api/src/routes/auth.ts

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { jwtAuth, signToken } from '../middleware/auth';

export const authRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Login
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (user.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (!user[0].isActive) {
    return c.json({ error: 'Account is disabled' }, 401);
  }

  // First login: password hash is null, allow any password and set it
  if (user[0].passwordHash === null) {
    const hash = await Bun.password.hash(password);
    await db
      .update(users)
      .set({ passwordHash: hash, lastLoginAt: new Date() })
      .where(eq(users.id, user[0].id));
  } else {
    // Verify password
    const valid = await Bun.password.verify(password, user[0].passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user[0].id));
  }

  // Generate JWT
  const token = await signToken({
    sub: user[0].id,
    username: user[0].username,
    role: user[0].role,
    name: user[0].name,
  });

  return c.json({
    token,
    user: {
      id: user[0].id,
      username: user[0].username,
      name: user[0].name,
      role: user[0].role,
    },
  });
});

// Get current user info
authRoutes.get('/me', jwtAuth, async (c) => {
  const payload = c.get('user');
  return c.json(payload);
});
