// packages/api/src/routes/reference.ts
// Reference data routes: Parts, Downtime Reasons, Shifts, Product Lines

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { downtimeReasons, machineParts, machines, parts, productLines, shifts } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const referenceRoutes = new Hono();

// ============== PARTS ==============

referenceRoutes.get('/parts', async (c) => {
  const allParts = await db.select().from(parts).orderBy(parts.partNumber);

  // Get compatibility mappings with machine names
  const mappings = await db
    .select({
      partNumber: machineParts.partNumber,
      machineName: machines.machineName,
      machineId: machines.machineId,
    })
    .from(machineParts)
    .leftJoin(machines, eq(machineParts.machineId, machines.machineId));

  // internal map for faster lookup
  const compatibilityMap = new Map<string, { names: Set<string>; ids: Set<number> }>();
  for (const m of mappings) {
    if (m.partNumber && m.machineName && m.machineId) {
      if (!compatibilityMap.has(m.partNumber)) {
        compatibilityMap.set(m.partNumber, { names: new Set(), ids: new Set() });
      }
      compatibilityMap.get(m.partNumber)?.names.add(m.machineName);
      compatibilityMap.get(m.partNumber)?.ids.add(m.machineId);
    }
  }

  // Merge
  const result = allParts.map((p) => {
    const entry = compatibilityMap.get(p.partNumber);
    return {
      ...p,
      compatibleMachines: entry ? Array.from(entry.names).sort() : [],
      machineIds: entry ? Array.from(entry.ids).sort((a, b) => a - b) : [],
    };
  });

  return c.json(result);
});

referenceRoutes.get('/parts/:partNumber', async (c) => {
  const partNumber = c.req.param('partNumber');
  const part = await db.select().from(parts).where(eq(parts.partNumber, partNumber)).limit(1);

  if (part.length === 0) {
    return c.json({ error: 'Part not found' }, 404);
  }

  // Get machines that can produce this part
  const capabilities = await db
    .select()
    .from(machineParts)
    .where(eq(machineParts.partNumber, partNumber));

  return c.json({ ...part[0], machines: capabilities });
});

const partSchema = z.object({
  partNumber: z.string().min(1),
  partName: z.string().min(1),
  productLine: z.string().optional(),
  machineIds: z.array(z.number()).optional(),
});

referenceRoutes.post(
  '/parts',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', partSchema),
  async (c) => {
    const { machineIds, ...partData } = c.req.valid('json');

    await db.transaction(async (tx) => {
      await tx.insert(parts).values(partData).onConflictDoNothing();

      if (machineIds) {
        // Since it's a new part, we can just insert
        if (machineIds.length > 0) {
          await tx.insert(machineParts).values(
            machineIds.map((mid) => ({
              machineId: mid,
              partNumber: partData.partNumber,
            }))
          );
        }
      }
    });

    return c.json({ success: true, partNumber: partData.partNumber });
  }
);

referenceRoutes.patch(
  '/parts/:partNumber',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', partSchema.partial()),
  async (c) => {
    const partNumber = c.req.param('partNumber');
    const { machineIds, ...updates } = c.req.valid('json');

    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.update(parts).set(updates).where(eq(parts.partNumber, partNumber));
      }

      if (machineIds !== undefined) {
        // Replace all mappings
        await tx.delete(machineParts).where(eq(machineParts.partNumber, partNumber));

        if (machineIds.length > 0) {
          await tx.insert(machineParts).values(
            machineIds.map((mid) => ({
              machineId: mid,
              partNumber: partNumber,
            }))
          );
        }
      }
    });

    return c.json({ success: true });
  }
);

referenceRoutes.delete('/parts/:partNumber', jwtAuth, requireRole('admin'), async (c) => {
  const partNumber = c.req.param('partNumber');

  await db.delete(parts).where(eq(parts.partNumber, partNumber));

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
