// packages/api/src/routes/status.ts

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { machines, statusLogs } from '../db/schema';
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

  await db
    .insert(machines)
    .values({
      machineId: data.machineId,
      machineName: data.machineName,
      status: data.status,
      green: data.green,
      red: data.red,
      cycleCount: data.cycleCount,
      lastSeen: now,
    })
    .onConflictDoUpdate({
      target: machines.machineId,
      set: {
        machineName: data.machineName,
        status: data.status,
        green: data.green,
        red: data.red,
        cycleCount: data.cycleCount,
        lastSeen: now,
      },
    });

  // Log status
  await db.insert(statusLogs).values({
    machineId: data.machineId,
    status: data.status,
    cycleCount: data.cycleCount,
  });

  return c.json({ received: true });
});
