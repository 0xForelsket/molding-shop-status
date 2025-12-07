// packages/api/src/routes/reference.ts
// Reference data routes: Items, Routing, Downtime Reasons, Shifts, Product Lines

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  downtimeReasons,
  items,
  productLines,
  productionSupervisors,
  routing,
  scrapReasons,
  shiftBreaks,
  shifts,
  workCenters,
} from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const referenceRoutes = new Hono();

// ============== ITEMS ==============

referenceRoutes.get('/parts', async (c) => {
  const allItems = await db.select().from(items).orderBy(items.itemNumber);

  // Get routing mappings with work center names
  const mappings = await db
    .select({
      itemNumber: routing.itemNumber,
      workCenterName: workCenters.name,
      workCenterId: workCenters.id,
    })
    .from(routing)
    .leftJoin(workCenters, eq(routing.workCenterId, workCenters.id));

  const compatibilityMap = new Map<string, { names: Set<string>; ids: Set<number> }>();
  for (const m of mappings) {
    if (m.itemNumber && m.workCenterName && m.workCenterId) {
      if (!compatibilityMap.has(m.itemNumber)) {
        compatibilityMap.set(m.itemNumber, { names: new Set(), ids: new Set() });
      }
      compatibilityMap.get(m.itemNumber)?.names.add(m.workCenterName);
      compatibilityMap.get(m.itemNumber)?.ids.add(m.workCenterId);
    }
  }

  const result = allItems.map((item) => {
    const entry = compatibilityMap.get(item.itemNumber);
    return {
      ...item,
      compatibleWorkCenters: entry ? Array.from(entry.names).sort() : [],
      workCenterIds: entry ? Array.from(entry.ids).sort((a, b) => a - b) : [],
    };
  });

  return c.json(result);
});

referenceRoutes.get('/parts/:itemNumber', async (c) => {
  const itemNumber = c.req.param('itemNumber');
  const item = await db.select().from(items).where(eq(items.itemNumber, itemNumber)).limit(1);

  if (item.length === 0) {
    return c.json({ error: 'Item not found' }, 404);
  }

  const routes = await db.select().from(routing).where(eq(routing.itemNumber, itemNumber));

  return c.json({ ...item[0], routing: routes });
});

const itemSchema = z.object({
  itemNumber: z.string().min(1),
  name: z.string().min(1),
  materialType: z.enum(['ROH', 'HALB', 'FERT']).optional().default('HALB'),
  uom: z.string().optional().default('PCS'),
  productLine: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  partWeight: z.number().optional().nullable(),
  runnerWeight: z.number().optional().nullable(),
  workCenterIds: z.array(z.number()).optional(),
});

referenceRoutes.post(
  '/parts',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', itemSchema),
  async (c) => {
    const { workCenterIds, ...itemData } = c.req.valid('json');

    await db.transaction(async (tx) => {
      await tx.insert(items).values(itemData).onConflictDoNothing();

      if (workCenterIds && workCenterIds.length > 0) {
        await tx.insert(routing).values(
          workCenterIds.map((wcId) => ({
            workCenterId: wcId,
            itemNumber: itemData.itemNumber,
          }))
        );
      }
    });

    return c.json({ success: true, itemNumber: itemData.itemNumber });
  }
);

referenceRoutes.patch(
  '/parts/:itemNumber',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', itemSchema.partial()),
  async (c) => {
    const itemNumber = c.req.param('itemNumber');
    const { workCenterIds, ...updates } = c.req.valid('json');

    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.update(items).set(updates).where(eq(items.itemNumber, itemNumber));
      }

      if (workCenterIds !== undefined) {
        await tx.delete(routing).where(eq(routing.itemNumber, itemNumber));

        if (workCenterIds.length > 0) {
          await tx.insert(routing).values(
            workCenterIds.map((wcId) => ({
              workCenterId: wcId,
              itemNumber: itemNumber,
            }))
          );
        }
      }
    });

    return c.json({ success: true });
  }
);

referenceRoutes.delete('/parts/:itemNumber', jwtAuth, requireRole('admin'), async (c) => {
  const itemNumber = c.req.param('itemNumber');
  await db.delete(items).where(eq(items.itemNumber, itemNumber));
  return c.json({ success: true });
});

// ============== DOWNTIME REASONS ==============

referenceRoutes.get('/downtime-reasons', async (c) => {
  const reasons = await db
    .select()
    .from(downtimeReasons)
    .orderBy(downtimeReasons.category, downtimeReasons.name);
  return c.json(reasons);
});

const downtimeReasonSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['planned', 'unplanned']),
  isActive: z.boolean().default(true),
});

referenceRoutes.post(
  '/downtime-reasons',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', downtimeReasonSchema),
  async (c) => {
    const data = c.req.valid('json');
    await db.insert(downtimeReasons).values(data).onConflictDoNothing();
    return c.json({ success: true, code: data.code });
  }
);

referenceRoutes.patch(
  '/downtime-reasons/:code',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', downtimeReasonSchema.partial()),
  async (c) => {
    const code = c.req.param('code');
    const updates = c.req.valid('json');
    await db.update(downtimeReasons).set(updates).where(eq(downtimeReasons.code, code));
    return c.json({ success: true });
  }
);

// ============== SHIFTS ==============

referenceRoutes.get('/shifts', async (c) => {
  const allShifts = await db.select().from(shifts).orderBy(shifts.startTime);
  return c.json(allShifts);
});

const shiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

referenceRoutes.post(
  '/shifts',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', shiftSchema),
  async (c) => {
    const data = c.req.valid('json');
    const result = await db.insert(shifts).values(data).returning();
    return c.json({ success: true, id: result[0].id });
  }
);

referenceRoutes.patch(
  '/shifts/:id',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', shiftSchema.partial()),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');
    await db.update(shifts).set(updates).where(eq(shifts.id, id));
    return c.json({ success: true });
  }
);

// ============== PRODUCT LINES ==============

referenceRoutes.get('/product-lines', async (c) => {
  const lines = await db.select().from(productLines).orderBy(productLines.name);
  return c.json(lines);
});

const productLineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

referenceRoutes.post(
  '/product-lines',
  jwtAuth,
  requireRole('admin'),
  zValidator('json', productLineSchema),
  async (c) => {
    const data = c.req.valid('json');
    await db.insert(productLines).values(data).onConflictDoNothing();
    return c.json({ success: true, code: data.code });
  }
);

referenceRoutes.patch(
  '/product-lines/:code',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', productLineSchema.partial()),
  async (c) => {
    const code = c.req.param('code');
    const updates = c.req.valid('json');
    await db.update(productLines).set(updates).where(eq(productLines.code, code));
    return c.json({ success: true });
  }
);

// ============== SHIFT BREAKS ==============

referenceRoutes.get('/shift-breaks', async (c) => {
  const breaks = await db
    .select()
    .from(shiftBreaks)
    .orderBy(shiftBreaks.shiftId, shiftBreaks.startTime);
  return c.json(breaks);
});

const shiftBreakSchema = z.object({
  shiftId: z.number(),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

referenceRoutes.post(
  '/shift-breaks',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', shiftBreakSchema),
  async (c) => {
    const data = c.req.valid('json');
    const result = await db.insert(shiftBreaks).values(data).returning();
    return c.json({ success: true, id: result[0].id });
  }
);

referenceRoutes.patch(
  '/shift-breaks/:id',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', shiftBreakSchema.partial()),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');
    await db.update(shiftBreaks).set(updates).where(eq(shiftBreaks.id, id));
    return c.json({ success: true });
  }
);

referenceRoutes.delete(
  '/shift-breaks/:id',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    await db.delete(shiftBreaks).where(eq(shiftBreaks.id, id));
    return c.json({ success: true });
  }
);

// ============== SCRAP REASONS ==============

referenceRoutes.get('/scrap-reasons', async (c) => {
  const reasons = await db
    .select()
    .from(scrapReasons)
    .orderBy(scrapReasons.category, scrapReasons.name);
  return c.json(reasons);
});

// ============== PRODUCTION SUPERVISORS ==============

referenceRoutes.get('/production-supervisors', async (c) => {
  const supervisors = await db
    .select()
    .from(productionSupervisors)
    .orderBy(productionSupervisors.code);
  return c.json(supervisors);
});
