// packages/api/src/routes/bom.ts
// Routes for managing Bill of Materials (BOM)

import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { bom, items } from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const bomRoutes = new Hono();

// ============== GET ALL BOM ENTRIES ==============

bomRoutes.get('/', async (c) => {
  const allBom = await db
    .select({
      id: bom.id,
      parentItem: bom.parentItem,
      parentName: items.name,
      childItem: bom.childItem,
      quantity: bom.quantity,
      uom: bom.uom,
      notes: bom.notes,
    })
    .from(bom)
    .leftJoin(items, eq(bom.parentItem, items.itemNumber))
    .orderBy(bom.parentItem);

  return c.json(allBom);
});

// ============== GET BOM FOR PARENT ITEM ==============

bomRoutes.get('/parent/:parentItem', async (c) => {
  const parentItem = c.req.param('parentItem');

  // Get parent item info
  const parent = await db.select().from(items).where(eq(items.itemNumber, parentItem)).limit(1);

  if (parent.length === 0) {
    return c.json({ error: 'Parent item not found' }, 404);
  }

  // Get child items with their details
  const children = await db
    .select({
      id: bom.id,
      childItem: bom.childItem,
      childName: items.name,
      childUom: items.uom,
      quantity: bom.quantity,
      uom: bom.uom,
      notes: bom.notes,
    })
    .from(bom)
    .leftJoin(items, eq(bom.childItem, items.itemNumber))
    .where(eq(bom.parentItem, parentItem))
    .orderBy(bom.childItem);

  return c.json({
    parent: parent[0],
    components: children,
  });
});

// ============== GET BOM ENTRY BY ID ==============

bomRoutes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const entry = await db
    .select({
      id: bom.id,
      parentItem: bom.parentItem,
      childItem: bom.childItem,
      quantity: bom.quantity,
      uom: bom.uom,
      notes: bom.notes,
    })
    .from(bom)
    .where(eq(bom.id, id))
    .limit(1);

  if (entry.length === 0) {
    return c.json({ error: 'BOM entry not found' }, 404);
  }

  return c.json(entry[0]);
});

// ============== CREATE BOM ENTRY ==============

const bomSchema = z.object({
  parentItem: z.string().min(1),
  childItem: z.string().min(1),
  quantity: z.number().positive(),
  uom: z.string().optional(),
  notes: z.string().optional(),
});

bomRoutes.post(
  '/',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', bomSchema),
  async (c) => {
    const data = c.req.valid('json');

    // Validate parent item exists
    const parent = await db
      .select()
      .from(items)
      .where(eq(items.itemNumber, data.parentItem))
      .limit(1);
    if (parent.length === 0) {
      return c.json({ error: 'Parent item not found' }, 404);
    }

    // Validate child item exists
    const child = await db
      .select()
      .from(items)
      .where(eq(items.itemNumber, data.childItem))
      .limit(1);
    if (child.length === 0) {
      return c.json({ error: 'Child item not found' }, 404);
    }

    // Check for circular reference
    if (data.parentItem === data.childItem) {
      return c.json({ error: 'Parent and child cannot be the same item' }, 400);
    }

    // Check if this BOM entry already exists
    const existing = await db
      .select()
      .from(bom)
      .where(and(eq(bom.parentItem, data.parentItem), eq(bom.childItem, data.childItem)))
      .limit(1);
    if (existing.length > 0) {
      return c.json({ error: 'BOM entry already exists for this parent-child combination' }, 409);
    }

    const result = await db.insert(bom).values(data).returning();
    return c.json({ success: true, id: result[0].id }, 201);
  }
);

// ============== UPDATE BOM ENTRY ==============

bomRoutes.patch(
  '/:id',
  jwtAuth,
  requireRole('admin', 'planner'),
  zValidator('json', bomSchema.partial().omit({ parentItem: true, childItem: true })),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');

    const existing = await db.select().from(bom).where(eq(bom.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: 'BOM entry not found' }, 404);
    }

    await db.update(bom).set(updates).where(eq(bom.id, id));
    return c.json({ success: true });
  }
);

// ============== DELETE BOM ENTRY ==============

bomRoutes.delete('/:id', jwtAuth, requireRole('admin'), async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const existing = await db.select().from(bom).where(eq(bom.id, id)).limit(1);
  if (existing.length === 0) {
    return c.json({ error: 'BOM entry not found' }, 404);
  }

  await db.delete(bom).where(eq(bom.id, id));
  return c.json({ success: true });
});
