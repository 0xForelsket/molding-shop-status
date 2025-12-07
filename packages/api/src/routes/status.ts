// packages/api/src/routes/status.ts

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { statusLogs, workCenters } from '../db/schema';
import { esp32Auth } from '../middleware/auth';

export const statusRoutes = new Hono();

// Validation schema for ESP32 status updates
const statusUpdateSchema = z.object({
  machineId: z.number(),
  machineName: z.string(),
  status: z.enum(['running', 'idle', 'fault', 'offline']),
  green: z.boolean(),
  red: z.boolean(),
  cycleCount: z.number(),
  uptimeSec: z.number().optional(),
});

// Receive status from ESP32 (requires API key)
statusRoutes.post('/', esp32Auth, zValidator('json', statusUpdateSchema), async (c) => {
  const data = c.req.valid('json');
  const now = new Date();

  // Check if work center exists
  const existing = await db
    .select()
    .from(workCenters)
    .where(eq(workCenters.id, data.machineId))
    .limit(1);

  if (existing.length === 0) {
    // Create new work center
    await db.insert(workCenters).values({
      id: data.machineId,
      name: data.machineName,
      status: data.status,
      green: data.green,
      red: data.red,
      cycleCount: data.cycleCount,
      lastSeen: now,
    });
  } else {
    // Update existing work center
    await db
      .update(workCenters)
      .set({
        name: data.machineName,
        status: data.status,
        green: data.green,
        red: data.red,
        cycleCount: data.cycleCount,
        lastSeen: now,
      })
      .where(eq(workCenters.id, data.machineId));
  }

  // Log status
  await db.insert(statusLogs).values({
    workCenterId: data.machineId,
    status: data.status,
    cycleCount: data.cycleCount,
  });

  return c.json({ received: true });
});
