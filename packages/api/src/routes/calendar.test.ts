// packages/api/src/routes/calendar.test.ts

import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Calendar API - Plant Calendar', () => {
  it('GET /api/calendar/plant-calendar without date range should return empty array', async () => {
    const res = await app.request('/api/calendar/plant-calendar');
    expect(res.status).toBe(200);

    const days = await res.json();
    expect(Array.isArray(days)).toBe(true);
  });

  it('GET /api/calendar/plant-calendar with date range should return array', async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const res = await app.request(
      `/api/calendar/plant-calendar?startDate=${today}&endDate=${nextWeek}`
    );
    expect(res.status).toBe(200);

    const days = await res.json();
    expect(Array.isArray(days)).toBe(true);
  });

  it('PATCH /api/calendar/plant-calendar/:date should require auth', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await app.request(`/api/calendar/plant-calendar/${today}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayType: 'holiday', name: 'Test Holiday' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Calendar API - Shift Instances', () => {
  it('GET /api/calendar/shift-instances should require date range', async () => {
    const res = await app.request('/api/calendar/shift-instances');
    expect(res.status).toBe(400);
  });

  it('GET /api/calendar/shift-instances with date range should return array', async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const res = await app.request(
      `/api/calendar/shift-instances?startDate=${today}&endDate=${nextWeek}`
    );
    expect(res.status).toBe(200);

    const instances = await res.json();
    expect(Array.isArray(instances)).toBe(true);
  });

  it('POST /api/calendar/shift-instances should require auth', async () => {
    const res = await app.request('/api/calendar/shift-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftTemplateId: 1,
        productionDate: new Date().toISOString().split('T')[0],
        plannedStartAt: '08:00',
        plannedEndAt: '16:00',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/calendar/shift-instances/:id should return 404 for unknown id', async () => {
    const res = await app.request('/api/calendar/shift-instances/99999');
    expect(res.status).toBe(404);
  });
});
