// packages/api/src/routes/downtime.ts

import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { downtimeLogs, downtimeReasons, shiftInstances, shifts, workCenters } from '../db/schema';

const app = new Hono();

// GET /downtime - Get downtime logs with optional filters
app.get('/', async (c) => {
  const machineId = c.req.query('machineId');
  const productionDate = c.req.query('productionDate');

  let query = db
    .select({
      downtimeLog: downtimeLogs,
      reason: {
        code: downtimeReasons.code,
        name: downtimeReasons.name,
        category: downtimeReasons.category,
      },
      machine: {
        machineId: workCenters.id,
        machineName: workCenters.name,
      },
      shiftInstance: {
        id: shiftInstances.id,
        productionDate: shiftInstances.productionDate,
      },
      shift: {
        name: shifts.name,
      },
    })
    .from(downtimeLogs)
    .leftJoin(downtimeReasons, eq(downtimeLogs.reasonCode, downtimeReasons.code))
    .leftJoin(workCenters, eq(downtimeLogs.workCenterId, workCenters.id))
    .leftJoin(shiftInstances, eq(downtimeLogs.shiftInstanceId, shiftInstances.id))
    .leftJoin(shifts, eq(shiftInstances.shiftTemplateId, shifts.id));

  const conditions = [];

  if (machineId) {
    conditions.push(eq(downtimeLogs.workCenterId, Number.parseInt(machineId)));
  }

  if (productionDate) {
    conditions.push(sql`DATE(${shiftInstances.productionDate}) = ${productionDate}`);
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const logs = await query.orderBy(downtimeLogs.startedAt);
  return c.json(logs);
});

// POST /downtime - Create a new downtime log
app.post('/', async (c) => {
  const body = await c.req.json();

  const { machineId, reasonCode, shiftInstanceId, notes, startedAt, endedAt, durationMinutes } =
    body;

  // Validate required fields
  if (!machineId || !reasonCode) {
    return c.json({ error: 'machineId and reasonCode are required' }, 400);
  }

  // Calculate duration if not provided but times are
  let calculatedDuration = durationMinutes;
  if (!calculatedDuration && startedAt && endedAt) {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    calculatedDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  const [newLog] = await db
    .insert(downtimeLogs)
    .values({
      workCenterId: machineId, // Map machineId to workCenterId
      reasonCode,
      shiftInstanceId: shiftInstanceId || null,
      notes: notes || null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : null,
      durationMinutes: calculatedDuration || null,
    })
    .returning();

  return c.json(newLog, 201);
});

// PATCH /downtime/:id - Update a downtime log
app.patch('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const body = await c.req.json();

  const updates: Record<string, unknown> = {};

  if (body.endedAt !== undefined) {
    updates.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  }
  if (body.durationMinutes !== undefined) {
    updates.durationMinutes = body.durationMinutes;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }
  if (body.reasonCode !== undefined) {
    updates.reasonCode = body.reasonCode;
  }

  const [updatedLog] = await db
    .update(downtimeLogs)
    .set(updates)
    .where(eq(downtimeLogs.id, id))
    .returning();

  if (!updatedLog) {
    return c.json({ error: 'Downtime log not found' }, 404);
  }

  return c.json(updatedLog);
});

// DELETE /downtime/:id - Delete a downtime log
app.delete('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const [deleted] = await db.delete(downtimeLogs).where(eq(downtimeLogs.id, id)).returning();

  if (!deleted) {
    return c.json({ error: 'Downtime log not found' }, 404);
  }

  return c.json({ success: true });
});

// GET /downtime/summary - Get downtime summary by reason
app.get('/summary', async (c) => {
  const machineId = c.req.query('machineId');
  const productionDate = c.req.query('productionDate');

  const conditions = [];

  if (machineId) {
    conditions.push(eq(downtimeLogs.workCenterId, Number.parseInt(machineId)));
  }

  if (productionDate) {
    conditions.push(sql`DATE(${shiftInstances.productionDate}) = ${productionDate}`);
  }

  let query = db
    .select({
      reasonCode: downtimeLogs.reasonCode,
      reasonName: downtimeReasons.name,
      category: downtimeReasons.category,
      totalMinutes: sql<number>`SUM(${downtimeLogs.durationMinutes})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(downtimeLogs)
    .leftJoin(downtimeReasons, eq(downtimeLogs.reasonCode, downtimeReasons.code))
    .leftJoin(shiftInstances, eq(downtimeLogs.shiftInstanceId, shiftInstances.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const summary = await query.groupBy(
    downtimeLogs.reasonCode,
    downtimeReasons.name,
    downtimeReasons.category
  );

  return c.json(summary);
});

export default app;
