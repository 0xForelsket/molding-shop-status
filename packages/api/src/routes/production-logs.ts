// packages/api/src/routes/production-logs.ts

import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { machines, parts, productionLogs, productionOrders, shifts } from '../db/schema';

const app = new Hono();

// GET /production-logs - Get production logs with optional filters
app.get('/', async (c) => {
  const machineId = c.req.query('machineId');
  const shiftDate = c.req.query('shiftDate');
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
      shift: {
        name: shifts.name,
      },
    })
    .from(productionLogs)
    .leftJoin(machines, eq(productionLogs.machineId, machines.machineId))
    .leftJoin(productionOrders, eq(productionLogs.orderNumber, productionOrders.orderNumber))
    .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
    .leftJoin(shifts, eq(productionLogs.shiftId, shifts.id));

  const conditions = [];

  if (machineId) {
    conditions.push(eq(productionLogs.machineId, Number.parseInt(machineId)));
  }

  if (shiftDate) {
    conditions.push(sql`DATE(${productionLogs.shiftDate}) = ${shiftDate}`);
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
    shiftId,
    shiftDate,
    quantityProduced = 0,
    quantityScrap = 0,
    startedAt,
    endedAt,
    status = 'in_progress',
    loggedBy,
    notes,
  } = body;

  // Validate required fields
  if (!machineId || !orderNumber || !shiftId || !shiftDate) {
    return c.json({ error: 'machineId, orderNumber, shiftId, and shiftDate are required' }, 400);
  }

  // Create the log
  const [newLog] = await db
    .insert(productionLogs)
    .values({
      machineId,
      orderNumber,
      shiftId,
      shiftDate: new Date(shiftDate),
      quantityProduced,
      quantityScrap,
      startedAt: startedAt ? new Date(startedAt) : null,
      endedAt: endedAt ? new Date(endedAt) : null,
      status,
      loggedBy,
      notes,
    })
    .returning();

  // Update the production order's quantityCompleted
  if (quantityProduced > 0) {
    await db
      .update(productionOrders)
      .set({
        quantityCompleted: sql`${productionOrders.quantityCompleted} + ${quantityProduced}`,
        status: 'running',
      })
      .where(eq(productionOrders.orderNumber, orderNumber));
  }

  // Update machine status and production order
  await db
    .update(machines)
    .set({
      status: 'running',
      productionOrder: orderNumber,
    })
    .where(eq(machines.machineId, machineId));

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
    .where(sql`DATE(${productionLogs.shiftDate}) = ${today}`)
    .groupBy(productionLogs.machineId);

  return c.json(summary);
});

export default app;
