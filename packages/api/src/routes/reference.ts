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
  routing,
  scrapReasons,
  shiftBreaks,
  shifts,
  workCenters,
} from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const referenceRoutes = new Hono();

// ============== ITEMS (Parts/Materials) ==============

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

  // internal map for faster lookup
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

  // Return with backward-compatible field names
  const result = allItems.map((item) => {
    const entry = compatibilityMap.get(item.itemNumber);
    return {
      partNumber: item.itemNumber,
      partName: item.name,
      imageUrl: item.imageUrl,
      productLine: item.productLine,
      materialType: item.materialType,
      createdAt: item.createdAt,
      compatibleMachines: entry ? Array.from(entry.names).sort() : [],
      machineIds: entry ? Array.from(entry.ids).sort((a, b) => a - b) : [],
    };
  });

  return c.json(result);
});

referenceRoutes.get('/parts/:partNumber', async (c) => {
  const itemNumber = c.req.param('partNumber');
  const item = await db.select().from(items).where(eq(items.itemNumber, itemNumber)).limit(1);

  if (item.length === 0) {
    return c.json({ error: 'Item not found' }, 404);
  }

  // Get routing for this item
  const routes = await db.select().from(routing).where(eq(routing.itemNumber, itemNumber));

  return c.json({
    partNumber: item[0].itemNumber,
    partName: item[0].name,
    imageUrl: item[0].imageUrl,
    productLine: item[0].productLine,
    materialType: item[0].materialType,
    machines: routes.map((r) => ({
      machineId: r.workCenterId,
      partNumber: r.itemNumber,
      cavityPlan: r.outputQty,
      targetCycleTime: r.cycleTime,
    })),
  });
});

const partSchema = z.object({
  partNumber: z.string().min(1),
  partName: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  productLine: z.string().optional(),
  materialType: z.enum(['ROH', 'HALB', 'FERT']).optional().default('HALB'),
  machineIds: z.array(z.number()).optional(),
});

referenceRoutes.post(
  '/parts',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', partSchema),
  async (c) => {
    const { machineIds, partNumber, partName, ...rest } = c.req.valid('json');

    await db.transaction(async (tx) => {
      await tx
        .insert(items)
        .values({
          itemNumber: partNumber,
          name: partName,
          ...rest,
        })
        .onConflictDoNothing();

      if (machineIds && machineIds.length > 0) {
        await tx.insert(routing).values(
          machineIds.map((mid) => ({
            workCenterId: mid,
            itemNumber: partNumber,
          }))
        );
      }
    });

    return c.json({ success: true, partNumber });
  }
);

referenceRoutes.patch(
  '/parts/:partNumber',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', partSchema.partial()),
  async (c) => {
    const itemNumber = c.req.param('partNumber');
    const { machineIds, partNumber, partName, ...updates } = c.req.valid('json');

    await db.transaction(async (tx) => {
      const setData: Record<string, unknown> = { ...updates };
      if (partName) setData.name = partName;

      if (Object.keys(setData).length > 0) {
        await tx.update(items).set(setData).where(eq(items.itemNumber, itemNumber));
      }

      if (machineIds !== undefined) {
        // Replace all routing mappings
        await tx.delete(routing).where(eq(routing.itemNumber, itemNumber));

        if (machineIds.length > 0) {
          await tx.insert(routing).values(
            machineIds.map((mid) => ({
              workCenterId: mid,
              itemNumber: itemNumber,
            }))
          );
        }
      }
    });

    return c.json({ success: true });
  }
);

referenceRoutes.delete('/parts/:partNumber', jwtAuth, requireRole('admin'), async (c) => {
  const itemNumber = c.req.param('partNumber');

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
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
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
