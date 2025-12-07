// packages/api/src/routes/machines.ts
// Work Center routes

import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { items, productionOrders, routing, statusLogs, workCenters } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const workCenterRoutes = new Hono();

// Offline threshold in seconds
const OFFLINE_THRESHOLD_SEC = 30;

// Get all work centers with current order info
workCenterRoutes.get('/', async (c) => {
  const allWorkCenters = await db.select().from(workCenters).orderBy(workCenters.id);

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
      ? await db.select().from(items).where(inArray(items.itemNumber, itemNumbers))
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
    const order = activeOrders.find((o) => o.workCenterId === wc.id);
    const item = order ? itemMap.get(order.itemNumber) : null;
    const routeInfo = order ? routingMap.get(`${wc.id}-${order.itemNumber}`) : null;

    return {
      ...wc,
      status: secondsSinceSeen && secondsSinceSeen > OFFLINE_THRESHOLD_SEC ? 'offline' : wc.status,
      secondsSinceSeen,
      // Current order info (derived from production_orders)
      currentOrder: order
        ? {
            orderNumber: order.orderNumber,
            itemNumber: order.itemNumber,
            itemName: item?.name ?? null,
            imageUrl: item?.imageUrl ?? null,
            cycleTime: routeInfo?.cycleTime ?? null,
            outputQty: routeInfo?.outputQty ?? 1,
            quantityRequired: order.quantityRequired,
            quantityCompleted: order.quantityCompleted,
          }
        : null,
    };
  });

  return c.json(result);
});

// Get single work center
workCenterRoutes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const workCenter = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);

  if (workCenter.length === 0) {
    return c.json({ error: 'Work center not found' }, 404);
  }

  // Get active order
  const order = await db
    .select({
      workCenterId: productionOrders.workCenterId,
      orderNumber: productionOrders.orderNumber,
      itemNumber: productionOrders.itemNumber,
      quantityRequired: productionOrders.quantityRequired,
      quantityCompleted: productionOrders.quantityCompleted,
      status: productionOrders.status,
    })
    .from(productionOrders)
    .where(
      and(
        eq(productionOrders.workCenterId, id),
        inArray(productionOrders.status, ['assigned', 'running'])
      )
    )
    .limit(1);

  let currentOrder = null;

  if (order.length > 0) {
    const item = await db
      .select()
      .from(items)
      .where(eq(items.itemNumber, order[0].itemNumber))
      .limit(1);

    const routeInfo = await db
      .select()
      .from(routing)
      .where(and(eq(routing.workCenterId, id), eq(routing.itemNumber, order[0].itemNumber)))
      .limit(1);

    currentOrder = {
      orderNumber: order[0].orderNumber,
      itemNumber: order[0].itemNumber,
      itemName: item[0]?.name ?? null,
      imageUrl: item[0]?.imageUrl ?? null,
      cycleTime: routeInfo[0]?.cycleTime ?? null,
      outputQty: routeInfo[0]?.outputQty ?? 1,
      quantityRequired: order[0].quantityRequired,
      quantityCompleted: order[0].quantityCompleted,
    };
  }

  return c.json({
    ...workCenter[0],
    currentOrder,
  });
});

// Assign order to work center
const assignOrderSchema = z.object({
  orderNumber: z.string().optional().nullable(),
});

workCenterRoutes.post(
  '/:id/assign-order',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', assignOrderSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const { orderNumber } = c.req.valid('json');

    const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
    if (wc.length === 0) {
      return c.json({ error: 'Work center not found' }, 404);
    }

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

    const order = await db
      .select()
      .from(productionOrders)
      .where(eq(productionOrders.orderNumber, orderNumber))
      .limit(1);

    if (order.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    await db
      .update(productionOrders)
      .set({ workCenterId: id, status: 'assigned' })
      .where(eq(productionOrders.orderNumber, orderNumber));

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

workCenterRoutes.post(
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

workCenterRoutes.post(
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

workCenterRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', workCenterSchema),
  async (c) => {
    const data = c.req.valid('json');

    const result = await db.insert(workCenters).values(data).returning();

    return c.json(result[0], 201);
  }
);

workCenterRoutes.put(
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

workCenterRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const wc = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
  if (wc.length === 0) {
    return c.json({ error: 'Work center not found' }, 404);
  }

  await db.delete(statusLogs).where(eq(statusLogs.workCenterId, id));
  await db.delete(routing).where(eq(routing.workCenterId, id));
  await db.delete(workCenters).where(eq(workCenters.id, id));

  return c.json({ success: true, deleted: wc[0].name });
});
