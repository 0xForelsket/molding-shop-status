// packages/api/src/routes/machines.ts

import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { machineParts, machines, parts, productionOrders, statusLogs } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const machineRoutes = new Hono();

// Offline threshold in seconds
const OFFLINE_THRESHOLD_SEC = 30;

// Get all machines
machineRoutes.get('/', async (c) => {
  const allMachines = await db
    .select({
      machineId: machines.machineId,
      machineName: machines.machineName,
      status: machines.status,
      green: machines.green,
      red: machines.red,
      cycleCount: machines.cycleCount,
      inputMode: machines.inputMode,
      statusUpdatedBy: machines.statusUpdatedBy,
      productionOrder: machines.productionOrder,
      partNumber: machines.partNumber,
      partName: machines.partName,
      targetCycleTime: machines.targetCycleTime,
      partsPerCycle: machines.partsPerCycle,
      brand: machines.brand,
      model: machines.model,
      serialNo: machines.serialNo,
      tonnage: machines.tonnage,
      screwDiameter: machines.screwDiameter,
      injectionWeight: machines.injectionWeight,
      is2K: machines.is2K,
      floorRow: machines.floorRow,
      floorPosition: machines.floorPosition,
      lastSeen: machines.lastSeen,
      createdAt: machines.createdAt,
      quantityRequired: productionOrders.quantityRequired,
      quantityCompleted: productionOrders.quantityCompleted,
    })
    .from(machines)
    .leftJoin(productionOrders, eq(machines.productionOrder, productionOrders.orderNumber))
    .orderBy(machines.machineId);

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

// Update machine configuration - auto-fills from order and machine_parts
const machineConfigSchema = z.object({
  productionOrder: z.string().optional().nullable(),
});

machineRoutes.post(
  '/:id/config',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', machineConfigSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const { productionOrder } = c.req.valid('json');

    // If no order, clear machine assignment
    if (!productionOrder) {
      await db
        .update(machines)
        .set({
          productionOrder: null,
          partNumber: null,
          partName: null,
          targetCycleTime: null,
          partsPerCycle: 1,
        })
        .where(eq(machines.machineId, id));

      return c.json({ success: true });
    }

    // Look up order to get part number
    const order = await db
      .select()
      .from(productionOrders)
      .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
      .where(eq(productionOrders.orderNumber, productionOrder))
      .limit(1);

    if (order.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const partNumber = order[0].production_orders.partNumber;
    const partName = order[0].parts?.partName ?? null;

    // Look up machine-specific cycle time for this part
    const machinePartConfig = await db
      .select()
      .from(machineParts)
      .where(and(eq(machineParts.machineId, id), eq(machineParts.partNumber, partNumber)))
      .limit(1);

    const targetCycleTime = machinePartConfig[0]?.targetCycleTime ?? null;
    const cavityPlan = machinePartConfig[0]?.cavityPlan ?? 1;

    // Update machine with all related data
    await db
      .update(machines)
      .set({
        productionOrder,
        partNumber,
        partName,
        targetCycleTime,
        partsPerCycle: cavityPlan,
      })
      .where(eq(machines.machineId, id));

    // Update order status to 'assigned' and link to machine
    await db
      .update(productionOrders)
      .set({ machineId: id, status: 'assigned' })
      .where(eq(productionOrders.orderNumber, productionOrder));

    return c.json({
      success: true,
      data: { productionOrder, partNumber, partName, targetCycleTime, partsPerCycle: cavityPlan },
    });
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

// ============== CRUD OPERATIONS ==============

// Schema for creating/updating machines
const machineSchema = z.object({
  machineName: z.string().min(1),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNo: z.string().optional().nullable(),
  tonnage: z.number().optional().nullable(),
  screwDiameter: z.number().optional().nullable(),
  injectionWeight: z.number().optional().nullable(),
  is2K: z.boolean().optional().default(false),
  floorRow: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
  floorPosition: z.number().optional().nullable(),
  inputMode: z.enum(['auto', 'manual']).optional().default('auto'),
});

// Create new machine
machineRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', machineSchema),
  async (c) => {
    const data = c.req.valid('json');

    const result = await db
      .insert(machines)
      .values({
        machineName: data.machineName,
        brand: data.brand,
        model: data.model,
        serialNo: data.serialNo,
        tonnage: data.tonnage,
        screwDiameter: data.screwDiameter,
        injectionWeight: data.injectionWeight,
        is2K: data.is2K,
        floorRow: data.floorRow,
        floorPosition: data.floorPosition,
        inputMode: data.inputMode,
      })
      .returning();

    return c.json(result[0], 201);
  }
);

// Update machine
machineRoutes.put(
  '/:id',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', machineSchema.partial()),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    const machine = await db.select().from(machines).where(eq(machines.machineId, id)).limit(1);
    if (machine.length === 0) {
      return c.json({ error: 'Machine not found' }, 404);
    }

    const result = await db
      .update(machines)
      .set(data)
      .where(eq(machines.machineId, id))
      .returning();

    return c.json(result[0]);
  }
);

// Delete machine
machineRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const machine = await db.select().from(machines).where(eq(machines.machineId, id)).limit(1);
  if (machine.length === 0) {
    return c.json({ error: 'Machine not found' }, 404);
  }

  // Delete related records first
  await db.delete(statusLogs).where(eq(statusLogs.machineId, id));
  await db.delete(machineParts).where(eq(machineParts.machineId, id));

  // Delete the machine
  await db.delete(machines).where(eq(machines.machineId, id));

  return c.json({ success: true, deleted: machine[0].machineName });
});
