// packages/api/src/routes/routing.ts
// Routes for managing item-to-work-center routing

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { items, molds, routing, workCenters } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const routingRoutes = new Hono();

// ============== GET ALL ROUTING ENTRIES ==============

routingRoutes.get('/', async (c) => {
  const allRouting = await db
    .select({
      id: routing.id,
      workCenterId: routing.workCenterId,
      workCenterName: workCenters.name,
      itemNumber: routing.itemNumber,
      itemName: items.name,
      moldId: routing.moldId,
      moldName: molds.name,
      cycleTime: routing.cycleTime,
      outputQty: routing.outputQty,
      setupTime: routing.setupTime,
      notes: routing.notes,
    })
    .from(routing)
    .leftJoin(workCenters, eq(routing.workCenterId, workCenters.id))
    .leftJoin(items, eq(routing.itemNumber, items.itemNumber))
    .leftJoin(molds, eq(routing.moldId, molds.id))
    .orderBy(routing.id);

  return c.json(allRouting);
});

// ============== GET ROUTING BY ID ==============

routingRoutes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const entry = await db
    .select({
      id: routing.id,
      workCenterId: routing.workCenterId,
      workCenterName: workCenters.name,
      itemNumber: routing.itemNumber,
      itemName: items.name,
      moldId: routing.moldId,
      moldName: molds.name,
      cycleTime: routing.cycleTime,
      outputQty: routing.outputQty,
      setupTime: routing.setupTime,
      notes: routing.notes,
    })
    .from(routing)
    .leftJoin(workCenters, eq(routing.workCenterId, workCenters.id))
    .leftJoin(items, eq(routing.itemNumber, items.itemNumber))
    .leftJoin(molds, eq(routing.moldId, molds.id))
    .where(eq(routing.id, id))
    .limit(1);

  if (entry.length === 0) {
    return c.json({ error: 'Routing entry not found' }, 404);
  }

  return c.json(entry[0]);
});

// ============== GET ROUTING BY WORK CENTER ==============

routingRoutes.get('/work-center/:workCenterId', async (c) => {
  const workCenterId = Number.parseInt(c.req.param('workCenterId'));

  const entries = await db
    .select({
      id: routing.id,
      workCenterId: routing.workCenterId,
      itemNumber: routing.itemNumber,
      itemName: items.name,
      moldId: routing.moldId,
      moldName: molds.name,
      cycleTime: routing.cycleTime,
      outputQty: routing.outputQty,
      setupTime: routing.setupTime,
      notes: routing.notes,
    })
    .from(routing)
    .leftJoin(items, eq(routing.itemNumber, items.itemNumber))
    .leftJoin(molds, eq(routing.moldId, molds.id))
    .where(eq(routing.workCenterId, workCenterId))
    .orderBy(routing.itemNumber);

  return c.json(entries);
});

// ============== GET ROUTING BY ITEM ==============

routingRoutes.get('/item/:itemNumber', async (c) => {
  const itemNumber = c.req.param('itemNumber');

  const entries = await db
    .select({
      id: routing.id,
      workCenterId: routing.workCenterId,
      workCenterName: workCenters.name,
      itemNumber: routing.itemNumber,
      moldId: routing.moldId,
      moldName: molds.name,
      cycleTime: routing.cycleTime,
      outputQty: routing.outputQty,
      setupTime: routing.setupTime,
      notes: routing.notes,
    })
    .from(routing)
    .leftJoin(workCenters, eq(routing.workCenterId, workCenters.id))
    .leftJoin(molds, eq(routing.moldId, molds.id))
    .where(eq(routing.itemNumber, itemNumber))
    .orderBy(workCenters.name);

  return c.json(entries);
});

// ============== CREATE ROUTING ==============

const routingSchema = z.object({
  workCenterId: z.number().int().positive(),
  itemNumber: z.string().min(1),
  moldId: z.string().optional().nullable(),
  cycleTime: z.number().positive().optional().nullable(),
  outputQty: z.number().int().positive().optional().default(1),
  setupTime: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

routingRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', routingSchema),
  async (c) => {
    const data = c.req.valid('json');

    // Validate work center exists
    const wc = await db
      .select()
      .from(workCenters)
      .where(eq(workCenters.id, data.workCenterId))
      .limit(1);
    if (wc.length === 0) {
      return c.json({ error: 'Work center not found' }, 404);
    }

    // Validate item exists
    const item = await db
      .select()
      .from(items)
      .where(eq(items.itemNumber, data.itemNumber))
      .limit(1);
    if (item.length === 0) {
      return c.json({ error: 'Item not found' }, 404);
    }

    // Validate mold exists (if provided)
    if (data.moldId) {
      const mold = await db.select().from(molds).where(eq(molds.id, data.moldId)).limit(1);
      if (mold.length === 0) {
        return c.json({ error: 'Mold not found' }, 404);
      }
    }

    const result = await db.insert(routing).values(data).returning();
    return c.json({ success: true, id: result[0].id }, 201);
  }
);

// ============== UPDATE ROUTING ==============

routingRoutes.patch(
  '/:id',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', routingSchema.partial()),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');

    // Check routing exists
    const existing = await db.select().from(routing).where(eq(routing.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: 'Routing entry not found' }, 404);
    }

    // Validate work center if updating
    if (updates.workCenterId !== undefined) {
      const wc = await db
        .select()
        .from(workCenters)
        .where(eq(workCenters.id, updates.workCenterId))
        .limit(1);
      if (wc.length === 0) {
        return c.json({ error: 'Work center not found' }, 404);
      }
    }

    // Validate item if updating
    if (updates.itemNumber !== undefined) {
      const item = await db
        .select()
        .from(items)
        .where(eq(items.itemNumber, updates.itemNumber))
        .limit(1);
      if (item.length === 0) {
        return c.json({ error: 'Item not found' }, 404);
      }
    }

    // Validate mold if updating
    if (updates.moldId) {
      const mold = await db.select().from(molds).where(eq(molds.id, updates.moldId)).limit(1);
      if (mold.length === 0) {
        return c.json({ error: 'Mold not found' }, 404);
      }
    }

    await db.update(routing).set(updates).where(eq(routing.id, id));
    return c.json({ success: true });
  }
);

// ============== DELETE ROUTING ==============

routingRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const existing = await db.select().from(routing).where(eq(routing.id, id)).limit(1);
  if (existing.length === 0) {
    return c.json({ error: 'Routing entry not found' }, 404);
  }

  await db.delete(routing).where(eq(routing.id, id));
  return c.json({ success: true });
});
