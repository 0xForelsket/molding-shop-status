// packages/api/src/routes/machines.ts
// Work Center routes (formerly machines)

import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { items, productionOrders, routing, statusLogs, workCenters } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const machineRoutes = new Hono();

// Offline threshold in seconds
const OFFLINE_THRESHOLD_SEC = 30;

// Get all work centers with current order info
machineRoutes.get('/', async (c) => {
  // Get all work centers
  const allWorkCenters = await db
    .select({
      // Work center fields
      machineId: workCenters.id,
      machineName: workCenters.name,
      type: workCenters.type,
      status: workCenters.status,
      green: workCenters.green,
      red: workCenters.red,
      cycleCount: workCenters.cycleCount,
      inputMode: workCenters.inputMode,
      statusUpdatedBy: workCenters.statusUpdatedBy,
      brand: workCenters.brand,
      model: workCenters.model,
      serialNo: workCenters.serialNo,
      tonnage: workCenters.tonnage,
      screwDiameter: workCenters.screwDiameter,
      injectionWeight: workCenters.injectionWeight,
      is2K: workCenters.is2K,
      floorRow: workCenters.floorRow,
      floorPosition: workCenters.floorPosition,
      lastSeen: workCenters.lastSeen,
      createdAt: workCenters.createdAt,
    })
    .from(workCenters)
    .orderBy(workCenters.id);

  // Get active orders for each work center
  const activeOrders = await db
    .select({
      workCenterId: productionOrders.workCenterId,
      orderNumber: productionOrders.orderNumber,
      itemNumber: productionOrders.itemNumber,
      quantityRequired: productionOrders.quantityRequired,
      quantityCompleted: productionOrders.quantityCompleted,
      status: productionOrders.status,
    })
    .from(productionOrders)
    .where(inArray(productionOrders.status, ['assigned', 'running']));

  // Get item names for active orders
  const itemNumbers = [...new Set(activeOrders.map((o) => o.itemNumber))];
  const itemData =
    itemNumbers.length > 0
      ? await db
          .select({ itemNumber: items.itemNumber, name: items.name, imageUrl: items.imageUrl })
          .from(items)
          .where(inArray(items.itemNumber, itemNumbers))
      : [];
  const itemMap = new Map(itemData.map((i) => [i.itemNumber, i]));

  // Get routing info (cycle time, output qty)
  const routingData = await db.select().from(routing);
  const routingMap = new Map(routingData.map((r) => [`${r.workCenterId}-${r.itemNumber}`, r]));

  const now = Date.now();
  const result = allWorkCenters.map((wc) => {
    const lastSeenMs = wc.lastSeen ? new Date(wc.lastSeen).getTime() : null;
    const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : null;

    // Find active order for this work center
    const order = activeOrders.find((o) => o.workCenterId === wc.machineId);
    const item = order ? itemMap.get(order.itemNumber) : null;
    const routeInfo = order ? routingMap.get(`${wc.machineId}-${order.itemNumber}`) : null;

    return {
      ...wc,
      status: secondsSinceSeen && secondsSinceSeen > OFFLINE_THRESHOLD_SEC ? 'offline' : wc.status,
      secondsSinceSeen,
      // Current order info (derived from production_orders, not stored on work center)
      productionOrder: order?.orderNumber ?? null,
      partNumber: order?.itemNumber ?? null,
      partName: item?.name ?? null,
      imageUrl: item?.imageUrl ?? null,
      targetCycleTime: routeInfo?.cycleTime ?? null,
      partsPerCycle: routeInfo?.outputQty ?? 1,
      quantityRequired: order?.quantityRequired ?? null,
      quantityCompleted: order?.quantityCompleted ?? null,
    };
  });

  return c.json(result);
});

// Get single work center
machineRoutes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const workCenter = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);

  if (workCenter.length === 0) {
    return c.json({ error: 'Work center not found' }, 404);
  }

  return c.json(workCenter[0]);
});

// Assign order to work center
const assignOrderSchema = z.object({
  orderNumber: z.string().optional().nullable(),
});

machineRoutes.post(
  '/:id/assign-order',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', assignOrderSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const { orderNumber } = c.req.valid('json');

    // Check work center exists
    const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
    if (wc.length === 0) {
      return c.json({ error: 'Work center not found' }, 404);
    }

    // If no order, unassign current order from this work center
    if (!orderNumber) {
      await db
        .update(productionOrders)
        .set({ workCenterId: null, status: 'pending' })
        .where(
          and(
            eq(productionOrders.workCenterId, id),
            inArray(productionOrders.status, ['assigned', 'running'])
          )
        );
      return c.json({ success: true, message: 'Order unassigned' });
    }

    // Look up order
    const order = await db
      .select()
      .from(productionOrders)
      .where(eq(productionOrders.orderNumber, orderNumber))
      .limit(1);

    if (order.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Update order to assign to this work center
    await db
      .update(productionOrders)
      .set({ workCenterId: id, status: 'assigned' })
      .where(eq(productionOrders.orderNumber, orderNumber));

    // Get routing info for response
    const routeInfo = await db
      .select()
      .from(routing)
      .where(and(eq(routing.workCenterId, id), eq(routing.itemNumber, order[0].itemNumber)))
      .limit(1);

    return c.json({
      success: true,
      data: {
        orderNumber,
        itemNumber: order[0].itemNumber,
        cycleTime: routeInfo[0]?.cycleTime ?? null,
        outputQty: routeInfo[0]?.outputQty ?? 1,
      },
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

    const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);

    if (wc.length === 0) {
      return c.json({ error: 'Work center not found' }, 404);
    }

    if (wc[0].inputMode !== 'manual') {
      return c.json({ error: 'Work center is in auto mode. Change to manual mode first.' }, 400);
    }

    await db
      .update(workCenters)
      .set({
        status: data.status,
        statusUpdatedBy: data.updatedBy,
        cycleCount: data.cycleCount ?? wc[0].cycleCount,
        lastSeen: new Date(),
      })
      .where(eq(workCenters.id, id));

    await db.insert(statusLogs).values({
      workCenterId: id,
      status: data.status,
      cycleCount: data.cycleCount ?? wc[0].cycleCount,
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

    await db.update(workCenters).set({ inputMode: mode }).where(eq(workCenters.id, id));

    return c.json({ success: true, mode });
  }
);

// ============== CRUD OPERATIONS ==============

const workCenterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['injection', 'assembly', 'other']).optional().default('injection'),
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

// Create new work center
machineRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', workCenterSchema),
  async (c) => {
    const data = c.req.valid('json');

    const result = await db
      .insert(workCenters)
      .values({
        name: data.name,
        type: data.type,
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

// Update work center
machineRoutes.put(
  '/:id',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', workCenterSchema.partial()),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
    if (wc.length === 0) {
      return c.json({ error: 'Work center not found' }, 404);
    }

    const result = await db.update(workCenters).set(data).where(eq(workCenters.id, id)).returning();

    return c.json(result[0]);
  }
);

// Delete work center
machineRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
  if (wc.length === 0) {
    return c.json({ error: 'Work center not found' }, 404);
  }

  // Delete related records first
  await db.delete(statusLogs).where(eq(statusLogs.workCenterId, id));
  await db.delete(routing).where(eq(routing.workCenterId, id));

  // Delete the work center
  await db.delete(workCenters).where(eq(workCenters.id, id));

  return c.json({ success: true, deleted: wc[0].name });
});
