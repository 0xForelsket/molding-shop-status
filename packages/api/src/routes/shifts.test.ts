// packages/api/src/routes/shifts.test.ts

import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Shifts API', () => {
  it('GET /api/shifts should return array', async () => {
    const res = await app.request('/api/shifts');
    expect(res.status).toBe(200);

    const allShifts = await res.json();
    expect(Array.isArray(allShifts)).toBe(true);
  });

  it('GET /api/shifts/current should return shift or null', async () => {
    const res = await app.request('/api/shifts/current');
    expect(res.status).toBe(200);

    const currentShift = await res.json();
    // Could be null if no shift is active at this time
    expect(currentShift === null || typeof currentShift === 'object').toBe(true);
  });
});
