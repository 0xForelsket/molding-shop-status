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

// ============== HELPER FUNCTIONS ==============

// Combine date + time string into timestamp
function combineDateAndTime(dateStr: string, timeStr: string, addDays = 0): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(`${dateStr}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  return date;
}

// Generate shift instances for a specific date (idempotent)
async function generateShiftInstancesForDate(dateStr: string): Promise<number> {
  // Get all active shift templates
  const shiftTemplates = await db.select().from(shifts).where(eq(shifts.isActive, true));
  const templateBreaks = await db.select().from(shiftBreaks);

  let instancesCreated = 0;

  for (const template of shiftTemplates) {
    // Calculate planned start and end timestamps
    const plannedStartAt = combineDateAndTime(dateStr, template.startTime);

    // Handle overnight shifts (night shift ending next day)
    const startHour = Number.parseInt(template.startTime.split(':')[0]);
    const endHour = Number.parseInt(template.endTime.split(':')[0]);
    const crossesMidnight = endHour < startHour;

    const plannedEndAt = combineDateAndTime(dateStr, template.endTime, crossesMidnight ? 1 : 0);

    // Check if instance already exists
    const existing = await db
      .select()
      .from(shiftInstances)
      .where(
        and(
          eq(shiftInstances.shiftTemplateId, template.id),
          eq(shiftInstances.productionDate, dateStr)
        )
      );

    if (existing.length > 0) continue;

    // Insert shift instance
    const result = await db
      .insert(shiftInstances)
      .values({
        shiftTemplateId: template.id,
        productionDate: dateStr,
        plannedStartAt,
        plannedEndAt,
        status: 'scheduled',
        isOvertime: false,
      })
      .returning();

    if (result.length > 0) {
      instancesCreated++;

      // Create instance breaks from template defaults
      const breaks = templateBreaks.filter((b) => b.shiftId === template.id && b.isActive);

      for (const brk of breaks) {
        const breakStartAt = combineDateAndTime(dateStr, brk.startTime);
        const breakEndAt = combineDateAndTime(dateStr, brk.endTime);

        await db.insert(shiftInstanceBreaks).values({
          shiftInstanceId: result[0].id,
          name: brk.name,
          startTime: breakStartAt,
          endTime: breakEndAt,
        });
      }
    }
  }

  return instancesCreated;
}

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

    // Auto-generate shift instances if day is now working
    if (updates.dayType === 'working') {
      await generateShiftInstancesForDate(date);
    }

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

    let updatedCount = 0;
    for (const date of dates) {
      const result = await db
        .update(plantCalendar)
        .set({ dayType, name: name || null })
        .where(eq(plantCalendar.date, date))
        .returning();

      if (result.length > 0) {
        updatedCount++;

        // Auto-generate shift instances if day is now working
        if (dayType === 'working') {
          await generateShiftInstancesForDate(date);
        }
      }
    }

    return c.json({ success: true, updated: updatedCount });
  }
);

// Ensure shift instances exist for a date (public endpoint for frontend fallback)
calendarRoutes.post('/ensure-shift-instances', async (c) => {
  const date = c.req.query('date');

  if (!date) {
    return c.json({ error: 'date query parameter required' }, 400);
  }

  // Ensure calendar entry exists
  const calendarEntry = await db
    .select()
    .from(plantCalendar)
    .where(eq(plantCalendar.date, date))
    .limit(1);

  if (calendarEntry.length === 0) {
    // Create calendar entry as working day
    await db.insert(plantCalendar).values({
      date,
      dayType: 'working',
    });
  } else if (calendarEntry[0].dayType !== 'working' && calendarEntry[0].dayType !== 'special') {
    // Don't create shift instances for non-working days
    return c.json({ success: true, created: 0, message: 'Day is not a working day' });
  }

  const created = await generateShiftInstancesForDate(date);
  return c.json({ success: true, created });
});

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
