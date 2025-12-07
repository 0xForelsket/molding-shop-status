// packages/api/src/routes/molds.ts
// Routes for managing molds (injection molding tooling)

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { items, molds, routing, workCenters } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const moldsRoutes = new Hono();

// ============== GET ALL MOLDS ==============

moldsRoutes.get('/', async (c) => {
  const allMolds = await db.select().from(molds).orderBy(molds.id);
  return c.json(allMolds);
});

// ============== GET MOLD BY ID ==============

moldsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const mold = await db.select().from(molds).where(eq(molds.id, id)).limit(1);

  if (mold.length === 0) {
    return c.json({ error: 'Mold not found' }, 404);
  }

  // Get routing entries that use this mold
  const routes = await db
    .select({
      id: routing.id,
      workCenterId: routing.workCenterId,
      workCenterName: workCenters.name,
      itemNumber: routing.itemNumber,
      itemName: items.name,
      cycleTime: routing.cycleTime,
      outputQty: routing.outputQty,
      setupTime: routing.setupTime,
    })
    .from(routing)
    .leftJoin(workCenters, eq(routing.workCenterId, workCenters.id))
    .leftJoin(items, eq(routing.itemNumber, items.itemNumber))
    .where(eq(routing.moldId, id));

  return c.json({
    ...mold[0],
    routing: routes,
  });
});

// ============== CREATE MOLD ==============

const moldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cavities: z.number().int().min(1).default(1),
  runnerType: z.enum(['hot', 'cold']).optional(),
  gateType: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
  totalShots: z.number().int().default(0),
  maintenanceInterval: z.number().int().optional(),
});

moldsRoutes.post('/', jwtAuth, requireRole('admin'), zValidator('json', moldSchema), async (c) => {
  const data = c.req.valid('json');

  // Check if mold already exists
  const existing = await db.select().from(molds).where(eq(molds.id, data.id)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Mold with this ID already exists' }, 409);
  }

  await db.insert(molds).values(data);
  return c.json({ success: true, id: data.id }, 201);
});

// ============== UPDATE MOLD ==============

moldsRoutes.patch(
  '/:id',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', moldSchema.partial().omit({ id: true })),
  async (c) => {
    const id = c.req.param('id');
    const updates = c.req.valid('json');

    const existing = await db.select().from(molds).where(eq(molds.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: 'Mold not found' }, 404);
    }

    await db.update(molds).set(updates).where(eq(molds.id, id));
    return c.json({ success: true });
  }
);

// ============== DELETE MOLD ==============

moldsRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  const existing = await db.select().from(molds).where(eq(molds.id, id)).limit(1);
  if (existing.length === 0) {
    return c.json({ error: 'Mold not found' }, 404);
  }

  // Check if mold is used in any routing
  const usedInRouting = await db.select().from(routing).where(eq(routing.moldId, id)).limit(1);
  if (usedInRouting.length > 0) {
    return c.json({ error: 'Cannot delete mold that is used in routing' }, 409);
  }

  await db.delete(molds).where(eq(molds.id, id));
  return c.json({ success: true });
});
