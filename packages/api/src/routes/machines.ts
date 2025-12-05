// packages/api/src/routes/machines.ts

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { machines, statusLogs } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const machineRoutes = new Hono();

// Offline threshold in seconds
const OFFLINE_THRESHOLD_SEC = 30;

// Get all machines
machineRoutes.get('/', async (c) => {
  const allMachines = await db.select().from(machines).orderBy(machines.machineId);

  const now = Date.now();
  const result = allMachines.map((m) => {
    const lastSeenMs = m.lastSeen ? new Date(m.lastSeen).getTime() : null;
    const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : null;

    return {
      ...m,
      status: secondsSinceSeen && secondsSinceSeen > OFFLINE_THRESHOLD_SEC ? 'offline' : m.status,
      secondsSinceSeen,
    };
  });

  return c.json(result);
});

// Get single machine
machineRoutes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const machine = await db.select().from(machines).where(eq(machines.machineId, id)).limit(1);

  if (machine.length === 0) {
    return c.json({ error: 'Machine not found' }, 404);
  }

  return c.json(machine[0]);
});

// Update machine configuration (production order, part, etc.)
const machineConfigSchema = z.object({
  productionOrder: z.string().optional().nullable(),
  partNumber: z.string().optional().nullable(),
  partName: z.string().optional().nullable(),
  targetCycleTime: z.number().optional().nullable(),
  partsPerCycle: z.number().default(1),
});

machineRoutes.post(
  '/:id/config',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', machineConfigSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    await db
      .update(machines)
      .set({
        productionOrder: data.productionOrder,
        partNumber: data.partNumber,
        partName: data.partName,
        targetCycleTime: data.targetCycleTime,
        partsPerCycle: data.partsPerCycle,
      })
      .where(eq(machines.machineId, id));

    return c.json({ success: true });
  }
);

// Manual status update (for line leaders)
const manualStatusSchema = z.object({
  status: z.enum(['running', 'idle', 'fault', 'offline']),
  updatedBy: z.string().min(1),
  cycleCount: z.number().optional(),
});

machineRoutes.post(
  '/:id/manual-status',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', manualStatusSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    // Check if machine is in manual mode
    const machine = await db.select().from(machines).where(eq(machines.machineId, id)).limit(1);

    if (machine.length === 0) {
      return c.json({ error: 'Machine not found' }, 404);
    }

    if (machine[0].inputMode !== 'manual') {
      return c.json({ error: 'Machine is in auto mode. Change to manual mode first.' }, 400);
    }

    await db
      .update(machines)
      .set({
        status: data.status,
        statusUpdatedBy: data.updatedBy,
        cycleCount: data.cycleCount ?? machine[0].cycleCount,
        lastSeen: new Date(),
      })
      .where(eq(machines.machineId, id));

    // Log the status change
    await db.insert(statusLogs).values({
      machineId: id,
      status: data.status,
      cycleCount: data.cycleCount ?? machine[0].cycleCount,
    });

    return c.json({ success: true });
  }
);

// Toggle input mode (auto <-> manual)
const inputModeSchema = z.object({
  mode: z.enum(['auto', 'manual']),
});

machineRoutes.post(
  '/:id/input-mode',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', inputModeSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const { mode } = c.req.valid('json');

    await db.update(machines).set({ inputMode: mode }).where(eq(machines.machineId, id));

    return c.json({ success: true, mode });
  }
);
