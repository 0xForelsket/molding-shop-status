// packages/api/src/routes/shifts.ts

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { shifts } from '../db/schema';

const app = new Hono();

// GET /shifts - Get all shifts
app.get('/', async (c) => {
  const allShifts = await db.select().from(shifts).where(eq(shifts.isActive, true));
  return c.json(allShifts);
});

// GET /shifts/current - Get current shift based on time
app.get('/current', async (c) => {
  const allShifts = await db.select().from(shifts).where(eq(shifts.isActive, true));

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  for (const shift of allShifts) {
    const start = shift.startTime;
    const end = shift.endTime;

    // Handle overnight shifts (e.g., 22:00 - 06:00)
    if (start > end) {
      if (currentTime >= start || currentTime < end) {
        return c.json(shift);
      }
    } else {
      if (currentTime >= start && currentTime < end) {
        return c.json(shift);
      }
    }
  }

  // No matching shift found
  return c.json(null);
});

export default app;
