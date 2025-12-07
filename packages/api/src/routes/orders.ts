// packages/api/src/routes/orders.ts

import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { items, productionOrders, routing, workCenters } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const orderRoutes = new Hono();

// Get all production orders
orderRoutes.get('/', async (c) => {
  const orders = await db
    .select({
      production_orders: productionOrders,
      parts: items,
      machines: workCenters,
      machine_parts: routing,
    })
    .from(productionOrders)
    .leftJoin(items, eq(productionOrders.itemNumber, items.itemNumber))
    .leftJoin(workCenters, eq(productionOrders.workCenterId, workCenters.id))
    .leftJoin(
      routing,
      and(
        eq(productionOrders.workCenterId, routing.workCenterId),
        eq(productionOrders.itemNumber, routing.itemNumber)
      )
    )
    .orderBy(productionOrders.createdAt);

  // Transform to keep API response compatible
  return c.json(
    orders.map((o) => ({
      production_orders: {
        ...o.production_orders,
        partNumber: o.production_orders.itemNumber, // Alias for compatibility
      },
      parts: o.parts
        ? {
            partNumber: o.parts.itemNumber,
            partName: o.parts.name,
            imageUrl: o.parts.imageUrl,
          }
        : null,
      machines: o.machines
        ? {
            machineId: o.machines.id,
            machineName: o.machines.name,
          }
        : null,
      machine_parts: o.machine_parts
        ? {
            machineId: o.machine_parts.workCenterId,
            partNumber: o.machine_parts.itemNumber,
            cavityPlan: o.machine_parts.outputQty,
            targetCycleTime: o.machine_parts.cycleTime,
          }
        : null,
    }))
  );
});

// Get available orders for machine assignment
orderRoutes.get('/available', async (c) => {
  const orders = await db
    .select({
      orderNumber: productionOrders.orderNumber,
      itemNumber: productionOrders.itemNumber,
      itemName: items.name,
      quantityRequired: productionOrders.quantityRequired,
      quantityCompleted: productionOrders.quantityCompleted,
      status: productionOrders.status,
    })
    .from(productionOrders)
    .leftJoin(items, eq(productionOrders.itemNumber, items.itemNumber))
    .where(inArray(productionOrders.status, ['pending', 'assigned', 'running']))
    .orderBy(productionOrders.orderNumber);

  // Group by item number
  const byPart = new Map<string, { partName: string | null; orders: typeof orders }>();
  for (const order of orders) {
    if (!byPart.has(order.itemNumber)) {
      byPart.set(order.itemNumber, { partName: order.itemName, orders: [] });
    }
    byPart.get(order.itemNumber)?.orders.push(order);
  }

  // Fetch compatibility mappings
  const mappings = await db.select().from(routing);
  const compatibility: Record<string, number[]> = {};

  for (const m of mappings) {
    if (!compatibility[m.itemNumber]) {
      compatibility[m.itemNumber] = [];
    }
    compatibility[m.itemNumber].push(m.workCenterId);
  }

  // Return with backward-compatible field names
  return c.json({
    orders: orders.map((o) => ({
      ...o,
      partNumber: o.itemNumber,
      partName: o.itemName,
    })),
    byPart: Array.from(byPart.entries()).map(([itemNumber, data]) => ({
      partNumber: itemNumber,
      partName: data.partName,
      lowestOrder: data.orders[0].orderNumber,
      orderCount: data.orders.length,
    })),
    compatibility,
  });
});

// Create single production order
const productionOrderSchema = z.object({
  orderNumber: z.string().min(1),
  partNumber: z.string().min(1), // Accept partNumber for backward compatibility
  quantityRequired: z.number().positive(),
  machineId: z.number().optional(), // Accept machineId for backward compatibility
  dueDate: z.string().optional(),
  targetCycleTime: z.number().positive().optional(),
  targetUtilization: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

orderRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', productionOrderSchema),
  async (c) => {
    try {
      const data = c.req.valid('json');

      // Check for duplicate order number
      const existing = await db
        .select()
        .from(productionOrders)
        .where(eq(productionOrders.orderNumber, data.orderNumber))
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: `Order ${data.orderNumber} already exists` }, 409);
      }

      await db.insert(productionOrders).values({
        orderNumber: data.orderNumber,
        itemNumber: data.partNumber, // Map partNumber to itemNumber
        quantityRequired: data.quantityRequired,
        workCenterId: data.machineId, // Map machineId to workCenterId
        status: data.machineId ? 'assigned' : 'pending',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        targetCycleTime: data.targetCycleTime,
        targetUtilization: data.targetUtilization,
        notes: data.notes,
      });

      return c.json({ success: true, orderNumber: data.orderNumber });
    } catch (error) {
      console.error('Error creating order:', error);
      return c.json({ error: (error as Error).message }, 500);
    }
  }
);

// Bulk import production orders
orderRoutes.post('/bulk-import', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const contentType = c.req.header('Content-Type');
  let orders: { orderNumber: string; partNumber: string; quantity: number }[] = [];

  if (contentType?.includes('text/plain')) {
    const text = await c.req.text();
    const lines = text.trim().split('\n');

    for (const line of lines) {
      const [orderNumber, partNumber, quantityStr] = line.split('\t').map((s) => s.trim());
      const quantity = Number.parseInt(quantityStr, 10);
      if (orderNumber && partNumber && !Number.isNaN(quantity) && quantity > 0) {
        orders.push({ orderNumber, partNumber, quantity });
      }
    }
  } else {
    orders = await c.req.json();
  }

  if (orders.length === 0) {
    return c.json({ error: 'No valid orders to import' }, 400);
  }

  // Check for duplicates in database
  const existingOrders = await db
    .select({ orderNumber: productionOrders.orderNumber })
    .from(productionOrders)
    .where(
      inArray(
        productionOrders.orderNumber,
        orders.map((o) => o.orderNumber)
      )
    );

  const existingSet = new Set(existingOrders.map((o) => o.orderNumber));
  const duplicates = orders.filter((o) => existingSet.has(o.orderNumber));
  const newOrders = orders.filter((o) => !existingSet.has(o.orderNumber));

  const seenInImport = new Set<string>();
  const duplicatesInImport: string[] = [];

  for (const order of newOrders) {
    if (seenInImport.has(order.orderNumber)) {
      duplicatesInImport.push(order.orderNumber);
    }
    seenInImport.add(order.orderNumber);
  }

  const uniqueOrders = newOrders.filter((o) => !duplicatesInImport.includes(o.orderNumber));

  if (uniqueOrders.length > 0) {
    await db.insert(productionOrders).values(
      uniqueOrders.map((o) => ({
        orderNumber: o.orderNumber,
        itemNumber: o.partNumber, // Map partNumber to itemNumber
        quantityRequired: o.quantity,
      }))
    );
  }

  return c.json({
    imported: uniqueOrders.length,
    skippedDuplicates: duplicates.map((o) => o.orderNumber),
    duplicatesInImport,
  });
});

// Assign order to work center
orderRoutes.post('/:orderNumber/assign', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const { machineId } = await c.req.json();

  await db
    .update(productionOrders)
    .set({
      workCenterId: machineId, // Map machineId to workCenterId
      status: 'assigned',
    })
    .where(eq(productionOrders.orderNumber, orderNumber));

  return c.json({ success: true });
});

// Update order status
orderRoutes.patch('/:orderNumber', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const updates = await c.req.json();

  // Map machineId to workCenterId if present
  if (updates.machineId !== undefined) {
    updates.workCenterId = updates.machineId;
    updates.machineId = undefined;
  }

  await db
    .update(productionOrders)
    .set(updates)
    .where(eq(productionOrders.orderNumber, orderNumber));

  return c.json({ success: true });
});

// Delete order
orderRoutes.delete('/:orderNumber', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const orderNumber = c.req.param('orderNumber');

  await db.delete(productionOrders).where(eq(productionOrders.orderNumber, orderNumber));

  return c.json({ success: true });
});
