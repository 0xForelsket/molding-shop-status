// packages/api/src/db/seeds/calendar.ts
// Seed plant calendar for current year + next year

import { db } from '../index';
import { plantCalendar, shiftBreaks, shiftInstanceBreaks, shiftInstances, shifts } from '../schema';

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get day type based on day of week
function getDayType(date: Date): 'working' | 'weekend' {
  const day = date.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'working';
}

// Seed calendar entries
export async function seedCalendar(startYear?: number, endYear?: number) {
  const currentYear = new Date().getFullYear();
  const start = startYear ?? currentYear;
  const end = endYear ?? currentYear + 1;

  console.log(`Seeding plant calendar from ${start} to ${end}...`);

  const entries: { date: string; dayType: string; weekNum: number }[] = [];

  for (let year = start; year <= end; year++) {
    const startDate = new Date(year, 0, 1); // Jan 1
    const endDate = new Date(year, 11, 31); // Dec 31

    let current = startDate;
    while (current <= endDate) {
      entries.push({
        date: formatDate(current),
        dayType: getDayType(current),
        weekNum: getWeekNumber(current),
      });
      current = new Date(current.getTime() + 86400000); // Add 1 day
    }
  }

  // Batch insert with conflict handling
  const batchSize = 100;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await db.insert(plantCalendar).values(batch).onConflictDoNothing();
  }

  console.log(`✓ Seeded ${entries.length} calendar entries`);
}

// Combine date + time string into timestamp
function combineDateAndTime(dateStr: string, timeStr: string, addDays = 0): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  return date;
}

// Ensure shift instances are scheduled X days ahead
export async function ensureShiftSchedule(lookaheadDays = 42) {
  console.log(`Ensuring shift schedule for next ${lookaheadDays} days...`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all active shift templates with their breaks
  const shiftTemplates = await db.select().from(shifts);
  const templateBreaks = await db.select().from(shiftBreaks);

  // Generate calendar entries for the lookahead period
  const calendarDates: { date: string; dayType: string; weekNum: number }[] = [];
  let current = new Date(today);
  for (let i = 0; i < lookaheadDays; i++) {
    const dateStr = formatDate(current);
    calendarDates.push({
      date: dateStr,
      dayType: getDayType(current),
      weekNum: getWeekNumber(current),
    });
    current = new Date(current.getTime() + 86400000);
  }

  // Insert calendar entries if missing
  await db.insert(plantCalendar).values(calendarDates).onConflictDoNothing();

  let instancesCreated = 0;

  // For each date in range
  for (const calendarEntry of calendarDates) {
    // Skip non-working days
    if (calendarEntry.dayType !== 'working') continue;

    // For each shift template
    for (const template of shiftTemplates) {
      if (!template.isActive) continue;

      // Calculate planned start and end timestamps
      const plannedStartAt = combineDateAndTime(calendarEntry.date, template.startTime);

      // Handle overnight shifts (night shift ending next day)
      const startHour = Number.parseInt(template.startTime.split(':')[0]);
      const endHour = Number.parseInt(template.endTime.split(':')[0]);
      const crossesMidnight = endHour < startHour;

      const plannedEndAt = combineDateAndTime(
        calendarEntry.date,
        template.endTime,
        crossesMidnight ? 1 : 0
      );

      // Insert shift instance (idempotent)
      try {
        const result = await db
          .insert(shiftInstances)
          .values({
            shiftTemplateId: template.id,
            productionDate: calendarEntry.date,
            plannedStartAt,
            plannedEndAt,
            status: 'scheduled',
            isOvertime: false,
          })
          .onConflictDoNothing()
          .returning();

        if (result.length > 0) {
          instancesCreated++;

          // Create instance breaks from template defaults
          const breaks = templateBreaks.filter((b) => b.shiftId === template.id && b.isActive);

          for (const brk of breaks) {
            const breakStartAt = combineDateAndTime(calendarEntry.date, brk.startTime);
            const breakEndAt = combineDateAndTime(calendarEntry.date, brk.endTime);

            await db.insert(shiftInstanceBreaks).values({
              shiftInstanceId: result[0].id,
              name: brk.name,
              startTime: breakStartAt,
              endTime: breakEndAt,
            });
          }
        }
      } catch {
        // Instance already exists (unique constraint)
      }
    }
  }

  console.log(`✓ Created ${instancesCreated} new shift instances`);
}

// Run if called directly
if (import.meta.main) {
  await seedCalendar();
  await ensureShiftSchedule(42);
  console.log('Calendar seeding complete!');
  process.exit(0);
}
