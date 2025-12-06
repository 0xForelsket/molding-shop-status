// packages/api/src/routes/calendar.ts
// Plant Calendar and Shift Instances routes

import { zValidator } from '@hono/zod-validator';
import { and, eq, gte, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  plantCalendar,
  shiftBreaks,
  shiftInstanceBreaks,
  shiftInstances,
  shifts,
} from '../db/schema';
import { jwtAuth, requireRole } from '../middleware/auth';

export const calendarRoutes = new Hono();

// ============== PLANT CALENDAR ==============

// Get calendar entries for a date range
calendarRoutes.get('/plant-calendar', async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let query = db.select().from(plantCalendar);

  if (startDate && endDate) {
    query = query.where(
      and(gte(plantCalendar.date, startDate), lte(plantCalendar.date, endDate))
    ) as typeof query;
  } else if (startDate) {
    query = query.where(gte(plantCalendar.date, startDate)) as typeof query;
  }

  const entries = await query.orderBy(plantCalendar.date);
  return c.json(entries);
});

// Update calendar entry (change day type)
const calendarUpdateSchema = z.object({
  dayType: z.enum(['working', 'weekend', 'holiday', 'shutdown', 'special']),
  name: z.string().optional(),
  notes: z.string().optional(),
});

calendarRoutes.patch(
  '/plant-calendar/:date',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', calendarUpdateSchema),
  async (c) => {
    const date = c.req.param('date');
    const updates = c.req.valid('json');

    await db.update(plantCalendar).set(updates).where(eq(plantCalendar.date, date));

    return c.json({ success: true });
  }
);

// Bulk update calendar entries (for multi-day selection)
const bulkCalendarUpdateSchema = z.object({
  dates: z.array(z.string()),
  dayType: z.enum(['working', 'weekend', 'holiday', 'shutdown', 'special']),
  name: z.string().optional(),
});

calendarRoutes.patch(
  '/plant-calendar/bulk',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', bulkCalendarUpdateSchema),
  async (c) => {
    const { dates, dayType, name } = c.req.valid('json');

    for (const date of dates) {
      await db
        .update(plantCalendar)
        .set({ dayType, name: name || null })
        .where(eq(plantCalendar.date, date));
    }

    return c.json({ success: true, updated: dates.length });
  }
);

// ============== SHIFT INSTANCES ==============

// Get shift instances for a date range
calendarRoutes.get('/shift-instances', async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  if (!startDate || !endDate) {
    return c.json({ error: 'startDate and endDate required' }, 400);
  }

  const instances = await db
    .select({
      id: shiftInstances.id,
      shiftTemplateId: shiftInstances.shiftTemplateId,
      productionDate: shiftInstances.productionDate,
      plannedStartAt: shiftInstances.plannedStartAt,
      plannedEndAt: shiftInstances.plannedEndAt,
      actualStartAt: shiftInstances.actualStartAt,
      actualEndAt: shiftInstances.actualEndAt,
      status: shiftInstances.status,
      isOvertime: shiftInstances.isOvertime,
      notes: shiftInstances.notes,
      shiftName: shifts.name,
    })
    .from(shiftInstances)
    .leftJoin(shifts, eq(shiftInstances.shiftTemplateId, shifts.id))
    .where(
      and(
        gte(shiftInstances.productionDate, startDate),
        lte(shiftInstances.productionDate, endDate)
      )
    )
    .orderBy(shiftInstances.productionDate, shiftInstances.plannedStartAt);

  return c.json(instances);
});

// Get single shift instance with breaks
calendarRoutes.get('/shift-instances/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));

  const instance = await db.select().from(shiftInstances).where(eq(shiftInstances.id, id)).limit(1);

  if (instance.length === 0) {
    return c.json({ error: 'Shift instance not found' }, 404);
  }

  const breaks = await db
    .select()
    .from(shiftInstanceBreaks)
    .where(eq(shiftInstanceBreaks.shiftInstanceId, id));

  return c.json({ ...instance[0], breaks });
});

// Create shift instance (for overtime or custom shifts)
const shiftInstanceCreateSchema = z.object({
  shiftTemplateId: z.number(),
  productionDate: z.string(),
  plannedStartAt: z.string(),
  plannedEndAt: z.string(),
  isOvertime: z.boolean().default(true),
  notes: z.string().optional(),
});

calendarRoutes.post(
  '/shift-instances',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', shiftInstanceCreateSchema),
  async (c) => {
    const data = c.req.valid('json');

    // Ensure calendar entry exists
    const calendarEntry = await db
      .select()
      .from(plantCalendar)
      .where(eq(plantCalendar.date, data.productionDate))
      .limit(1);

    if (calendarEntry.length === 0) {
      // Create calendar entry
      await db.insert(plantCalendar).values({
        date: data.productionDate,
        dayType: 'working',
      });
    }

    const result = await db
      .insert(shiftInstances)
      .values({
        shiftTemplateId: data.shiftTemplateId,
        productionDate: data.productionDate,
        plannedStartAt: new Date(data.plannedStartAt),
        plannedEndAt: new Date(data.plannedEndAt),
        isOvertime: data.isOvertime,
        notes: data.notes,
        status: 'scheduled',
      })
      .returning();

    // Copy breaks from template
    const templateBreaks = await db
      .select()
      .from(shiftBreaks)
      .where(eq(shiftBreaks.shiftId, data.shiftTemplateId));

    for (const brk of templateBreaks) {
      if (!brk.isActive) continue;

      const [hours, minutes] = brk.startTime.split(':').map(Number);
      const [endHours, endMinutes] = brk.endTime.split(':').map(Number);

      const breakStart = new Date(data.productionDate);
      breakStart.setHours(hours, minutes, 0, 0);

      const breakEnd = new Date(data.productionDate);
      breakEnd.setHours(endHours, endMinutes, 0, 0);

      await db.insert(shiftInstanceBreaks).values({
        shiftInstanceId: result[0].id,
        name: brk.name,
        startTime: breakStart,
        endTime: breakEnd,
        durationMinutes: brk.durationMinutes,
      });
    }

    return c.json({ success: true, id: result[0].id });
  }
);

// Update shift instance
const shiftInstanceUpdateSchema = z.object({
  plannedStartAt: z.string().optional(),
  plannedEndAt: z.string().optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
  isOvertime: z.boolean().optional(),
  notes: z.string().optional(),
});

calendarRoutes.patch(
  '/shift-instances/:id',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', shiftInstanceUpdateSchema),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));
    const updates = c.req.valid('json');

    const updateData: Record<string, unknown> = {};
    if (updates.plannedStartAt) updateData.plannedStartAt = new Date(updates.plannedStartAt);
    if (updates.plannedEndAt) updateData.plannedEndAt = new Date(updates.plannedEndAt);
    if (updates.status) updateData.status = updates.status;
    if (updates.isOvertime !== undefined) updateData.isOvertime = updates.isOvertime;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    await db.update(shiftInstances).set(updateData).where(eq(shiftInstances.id, id));

    return c.json({ success: true });
  }
);

// Delete/cancel shift instance
calendarRoutes.delete(
  '/shift-instances/:id',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  async (c) => {
    const id = Number.parseInt(c.req.param('id'));

    // Delete breaks first
    await db.delete(shiftInstanceBreaks).where(eq(shiftInstanceBreaks.shiftInstanceId, id));

    // Delete instance
    await db.delete(shiftInstances).where(eq(shiftInstances.id, id));

    return c.json({ success: true });
  }
);

// Mark multiple dates as overtime/working
const bulkOvertimeSchema = z.object({
  dates: z.array(z.string()),
  isOvertime: z.boolean(),
});

calendarRoutes.patch(
  '/shift-instances/bulk-overtime',
  jwtAuth,
  requireRole('admin', 'line_leader'),
  zValidator('json', bulkOvertimeSchema),
  async (c) => {
    const { dates, isOvertime } = c.req.valid('json');

    for (const date of dates) {
      await db
        .update(shiftInstances)
        .set({ isOvertime })
        .where(eq(shiftInstances.productionDate, date));

      // Also update calendar day type based on overtime
      if (isOvertime) {
        await db
          .update(plantCalendar)
          .set({ dayType: 'special', name: 'Overtime' })
          .where(eq(plantCalendar.date, date));
      }
    }

    return c.json({ success: true, updated: dates.length });
  }
);
