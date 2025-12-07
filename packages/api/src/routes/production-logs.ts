// packages/api/src/routes/production-logs.ts

import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import {
  machines,
  parts,
  productionLogScraps,
  productionLogs,
  productionOrders,
  shiftInstances,
  shifts,
} from '../db/schema';

const app = new Hono();

// GET /production-logs - Get production logs with optional filters
app.get('/', async (c) => {
  const machineId = c.req.query('machineId');
  const productionDate = c.req.query('productionDate');
  const orderNumber = c.req.query('orderNumber');

  let query = db
    .select({
      productionLog: productionLogs,
      machine: {
        machineId: machines.machineId,
        machineName: machines.machineName,
      },
      order: {
        orderNumber: productionOrders.orderNumber,
        partNumber: productionOrders.partNumber,
        quantityRequired: productionOrders.quantityRequired,
      },
      part: {
        partName: parts.partName,
      },
      shiftInstance: {
        id: shiftInstances.id,
        productionDate: shiftInstances.productionDate,
      },
      shift: {
        name: shifts.name,
      },
    })
    .from(productionLogs)
    .leftJoin(machines, eq(productionLogs.machineId, machines.machineId))
    .leftJoin(productionOrders, eq(productionLogs.orderNumber, productionOrders.orderNumber))
    .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
    .leftJoin(shiftInstances, eq(productionLogs.shiftInstanceId, shiftInstances.id))
    .leftJoin(shifts, eq(shiftInstances.shiftTemplateId, shifts.id));

  const conditions = [];

  if (machineId) {
    conditions.push(eq(productionLogs.machineId, Number.parseInt(machineId)));
  }

  if (productionDate) {
    conditions.push(sql`DATE(${shiftInstances.productionDate}) = ${productionDate}`);
  }

  if (orderNumber) {
    conditions.push(eq(productionLogs.orderNumber, orderNumber));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const logs = await query.orderBy(productionLogs.createdAt);
  return c.json(logs);
});

// POST /production-logs - Create a new production log
app.post('/', async (c) => {
  const body = await c.req.json();

  const {
    machineId,
    orderNumber,
    shiftInstanceId: providedShiftInstanceId,
    shiftId,
    productionDate,
    quantityProduced = 0,
    quantityScrap = 0,
    scraps = [], // Array of { reasonId, quantity }
    startedAt,
    endedAt,
    status = 'in_progress',
    loggedBy,
    notes,
  } = body;

  // Validate required fields
  if (!machineId || !orderNumber) {
    return c.json({ error: 'machineId and orderNumber are required' }, 400);
  }

  // Either shiftInstanceId OR (shiftId + productionDate) must be provided
  if (!providedShiftInstanceId && (!shiftId || !productionDate)) {
    return c.json(
      { error: 'Either shiftInstanceId or (shiftId and productionDate) are required' },
      400
    );
  }

  let shiftInstanceId = providedShiftInstanceId;

  // If shiftInstanceId not provided, resolve or create from shiftId + productionDate
  if (!shiftInstanceId && shiftId && productionDate) {
    const dateStr =
      typeof productionDate === 'string'
        ? productionDate.split('T')[0]
        : new Date(productionDate).toISOString().split('T')[0];

    // Look for existing shift instance
    const existing = await db
      .select()
      .from(shiftInstances)
      .where(
        and(eq(shiftInstances.shiftTemplateId, shiftId), eq(shiftInstances.productionDate, dateStr))
      );

    if (existing.length > 0) {
      shiftInstanceId = existing[0].id;
    } else {
      // Get shift template to determine times
      const [shiftTemplate] = await db.select().from(shifts).where(eq(shifts.id, shiftId));

      if (!shiftTemplate) {
        return c.json({ error: 'Invalid shiftId' }, 400);
      }

      const [startHour, startMin] = shiftTemplate.startTime.split(':').map(Number);
      const [endHour, endMin] = shiftTemplate.endTime.split(':').map(Number);

      const plannedStart = new Date(`${dateStr}T00:00:00`);
      plannedStart.setHours(startHour, startMin, 0, 0);

      const plannedEnd = new Date(`${dateStr}T00:00:00`);
      plannedEnd.setHours(endHour, endMin, 0, 0);
      // Handle overnight shifts
      if (endHour < startHour) {
        plannedEnd.setDate(plannedEnd.getDate() + 1);
      }

      // Create new shift instance
      const [newInstance] = await db
        .insert(shiftInstances)
        .values({
          shiftTemplateId: shiftId,
          productionDate: dateStr,
          plannedStartAt: plannedStart,
          plannedEndAt: plannedEnd,
          status: 'active',
          isOvertime: false,
        })
        .returning();

      shiftInstanceId = newInstance.id;
    }
  }

  // Verify shiftInstanceId exists
  const [shiftInstance] = await db
    .select()
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId));

  if (!shiftInstance) {
    return c.json({ error: 'Invalid shiftInstanceId' }, 400);
  }

  // Calculate total scrap from details if provided
  let finalScrapQuantity = quantityScrap;
  if (scraps.length > 0) {
    finalScrapQuantity = scraps.reduce(
      (sum: number, s: { quantity: number }) => sum + s.quantity,
      0
    );
  }

  // Create the log
  const newLog = await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(productionLogs)
      .values({
        machineId,
        orderNumber,
        shiftInstanceId,
        quantityProduced,
        quantityScrap: finalScrapQuantity,
        startedAt: startedAt ? new Date(startedAt) : null,
        endedAt: endedAt ? new Date(endedAt) : null,
        status,
        loggedBy,
        notes,
      })
      .returning();

    // Insert detailed scrap records
    if (scraps.length > 0) {
      await tx.insert(productionLogScraps).values(
        scraps.map((s: { reasonId: number; quantity: number }) => ({
          productionLogId: log.id,
          scrapReasonId: s.reasonId,
          quantity: s.quantity,
        }))
      );
    }

    // Update the production order's quantityCompleted
    if (quantityProduced > 0) {
      await tx
        .update(productionOrders)
        .set({
          quantityCompleted: sql`${productionOrders.quantityCompleted} + ${quantityProduced}`,
          status: 'running',
        })
        .where(eq(productionOrders.orderNumber, orderNumber));
    }

    // Update machine status and production order
    await tx
      .update(machines)
      .set({
        status: 'running',
        productionOrder: orderNumber,
      })
      .where(eq(machines.machineId, machineId));

    return log;
  });

  return c.json(newLog, 201);
});

// PATCH /production-logs/:id - Update a production log
app.patch('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const body = await c.req.json();

  // Get the existing log to calculate quantity difference
  const [existingLog] = await db.select().from(productionLogs).where(eq(productionLogs.id, id));

  if (!existingLog) {
    return c.json({ error: 'Production log not found' }, 404);
  }

  const updates: Record<string, unknown> = {};

  if (body.quantityProduced !== undefined) updates.quantityProduced = body.quantityProduced;
  if (body.quantityScrap !== undefined) updates.quantityScrap = body.quantityScrap;
  if (body.startedAt !== undefined)
    updates.startedAt = body.startedAt ? new Date(body.startedAt) : null;
  if (body.endedAt !== undefined) updates.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;

  const [updatedLog] = await db
    .update(productionLogs)
    .set(updates)
    .where(eq(productionLogs.id, id))
    .returning();

  // Update production order quantity if changed
  if (body.quantityProduced !== undefined) {
    const quantityDiff = body.quantityProduced - (existingLog.quantityProduced || 0);
    if (quantityDiff !== 0) {
      await db
        .update(productionOrders)
        .set({
          quantityCompleted: sql`${productionOrders.quantityCompleted} + ${quantityDiff}`,
        })
        .where(eq(productionOrders.orderNumber, existingLog.orderNumber));
    }
  }

  // If status is 'completed', update machine to idle
  if (body.status === 'completed') {
    await db
      .update(machines)
      .set({
        status: 'idle',
        productionOrder: null,
      })
      .where(eq(machines.machineId, existingLog.machineId));
  }

  return c.json(updatedLog);
});

// GET /production-logs/today-summary - Get today's production summary
app.get('/today-summary', async (c) => {
  const today = new Date().toISOString().split('T')[0];

  const summary = await db
    .select({
      machineId: productionLogs.machineId,
      totalProduced: sql<number>`SUM(${productionLogs.quantityProduced})`,
      totalScrap: sql<number>`SUM(${productionLogs.quantityScrap})`,
    })
    .from(productionLogs)
    .leftJoin(shiftInstances, eq(productionLogs.shiftInstanceId, shiftInstances.id))
    .where(sql`DATE(${shiftInstances.productionDate}) = ${today}`)
    .groupBy(productionLogs.machineId);

  return c.json(summary);
});

export default app;
