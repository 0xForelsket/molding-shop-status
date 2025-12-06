// packages/api/src/routes/orders.ts

import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { machineParts, machines, parts, productionOrders } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const orderRoutes = new Hono();

// Get all production orders
// Get all production orders
orderRoutes.get('/', async (c) => {
  const orders = await db
    .select({
      production_orders: productionOrders,
      parts: parts,
      machines: machines,
      machine_parts: machineParts,
    })
    .from(productionOrders)
    .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
    .leftJoin(machines, eq(productionOrders.machineId, machines.machineId))
    .leftJoin(
      machineParts,
      and(
        eq(productionOrders.machineId, machineParts.machineId),
        eq(productionOrders.partNumber, machineParts.partNumber)
      )
    )
    .orderBy(productionOrders.createdAt);

  return c.json(orders);
});

// Get available orders for machine assignment (not completed/cancelled, sorted by order number)
orderRoutes.get('/available', async (c) => {
  const orders = await db
    .select({
      orderNumber: productionOrders.orderNumber,
      partNumber: productionOrders.partNumber,
      partName: parts.partName,
      quantityRequired: productionOrders.quantityRequired,
      quantityCompleted: productionOrders.quantityCompleted,
      status: productionOrders.status,
    })
    .from(productionOrders)
    .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
    .where(inArray(productionOrders.status, ['pending', 'assigned', 'running']))
    .orderBy(productionOrders.orderNumber);

  // Group by part number for the dropdown
  const byPart = new Map<string, { partName: string | null; orders: typeof orders }>();
  for (const order of orders) {
    if (!byPart.has(order.partNumber)) {
      byPart.set(order.partNumber, { partName: order.partName, orders: [] });
    }
    byPart.get(order.partNumber)?.orders.push(order);
  }

  // Fetch compatibility mappings
  const mappings = await db.select().from(machineParts);
  const compatibility: Record<string, number[]> = {};

  for (const m of mappings) {
    if (!compatibility[m.partNumber]) {
      compatibility[m.partNumber] = [];
    }
    compatibility[m.partNumber].push(m.machineId);
  }

  // Return flat list, grouped view, and compatibility map
  return c.json({
    orders,
    byPart: Array.from(byPart.entries()).map(([partNumber, data]) => ({
      partNumber,
      partName: data.partName,
      lowestOrder: data.orders[0].orderNumber, // First order (lowest) for this part
      orderCount: data.orders.length,
    })),
    compatibility,
  });
});

// Create single production order
const productionOrderSchema = z.object({
  orderNumber: z.string().min(1),
  partNumber: z.string().min(1),
  quantityRequired: z.number().positive(),
  machineId: z.number().optional(),
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
        partNumber: data.partNumber,
        quantityRequired: data.quantityRequired,
        machineId: data.machineId,
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

// Bulk import production orders (for Excel paste)
orderRoutes.post('/bulk-import', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const contentType = c.req.header('Content-Type');
  let orders: { orderNumber: string; partNumber: string; quantity: number }[] = [];

  if (contentType?.includes('text/plain')) {
    // Parse TSV from Excel paste (Order#, Part#, Quantity)
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
    // JSON array
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

  // Also check for duplicates within the import itself
  const seenInImport = new Set<string>();
  const duplicatesInImport: string[] = [];

  for (const order of newOrders) {
    if (seenInImport.has(order.orderNumber)) {
      duplicatesInImport.push(order.orderNumber);
    }
    seenInImport.add(order.orderNumber);
  }

  // Insert valid orders
  const uniqueOrders = newOrders.filter((o) => !duplicatesInImport.includes(o.orderNumber));

  if (uniqueOrders.length > 0) {
    await db.insert(productionOrders).values(
      uniqueOrders.map((o) => ({
        orderNumber: o.orderNumber,
        partNumber: o.partNumber,
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

// Assign order to machine
orderRoutes.post('/:orderNumber/assign', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const { machineId } = await c.req.json();

  await db
    .update(productionOrders)
    .set({
      machineId,
      status: 'assigned',
    })
    .where(eq(productionOrders.orderNumber, orderNumber));

  return c.json({ success: true });
});

// Update order status
orderRoutes.patch('/:orderNumber', jwtAuth, requireRole('admin', 'planner'), async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const updates = await c.req.json();

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
