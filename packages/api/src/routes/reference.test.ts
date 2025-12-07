import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Reference API - Items', () => {
  it('GET /api/reference/parts should return array', async () => {
    const res = await app.request('/api/reference/parts');
    expect(res.status).toBe(200);

    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
  });

  it('GET /api/reference/parts/:itemNumber should return 404 for unknown item', async () => {
    const res = await app.request('/api/reference/parts/UNKNOWN-ITEM-12345');
    expect(res.status).toBe(404);
  });

  it('POST /api/reference/parts should require auth', async () => {
    const res = await app.request('/api/reference/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemNumber: 'TEST-ITEM-001',
        name: 'Test Item',
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Reference API - Downtime Reasons', () => {
  it('GET /api/reference/downtime-reasons should return array', async () => {
    const res = await app.request('/api/reference/downtime-reasons');
    expect(res.status).toBe(200);

    const reasons = await res.json();
    expect(Array.isArray(reasons)).toBe(true);
  });

  it('POST /api/reference/downtime-reasons should require auth', async () => {
    const res = await app.request('/api/reference/downtime-reasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'TEST-DR-001',
        name: 'Test Downtime',
        category: 'unplanned',
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Reference API - Product Lines', () => {
  it('GET /api/reference/product-lines should return array', async () => {
    const res = await app.request('/api/reference/product-lines');
    expect(res.status).toBe(200);

    const lines = await res.json();
    expect(Array.isArray(lines)).toBe(true);
  });

  it('POST /api/reference/product-lines should require auth', async () => {
    const res = await app.request('/api/reference/product-lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'TEST-LINE',
        name: 'Test Product Line',
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Reference API - Shifts', () => {
  it('GET /api/reference/shifts should return array', async () => {
    const res = await app.request('/api/reference/shifts');
    expect(res.status).toBe(200);

    const allShifts = await res.json();
    expect(Array.isArray(allShifts)).toBe(true);
  });

  it('POST /api/reference/shifts should require auth', async () => {
    const res = await app.request('/api/reference/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Shift',
        startTime: '08:00',
        endTime: '16:00',
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Reference API - Shift Breaks', () => {
  it('GET /api/reference/shift-breaks should return array', async () => {
    const res = await app.request('/api/reference/shift-breaks');
    expect(res.status).toBe(200);

    const breaks = await res.json();
    expect(Array.isArray(breaks)).toBe(true);
  });
});

describe('Reference API - Scrap Reasons', () => {
  it('GET /api/reference/scrap-reasons should return array', async () => {
    const res = await app.request('/api/reference/scrap-reasons');
    expect(res.status).toBe(200);

    const reasons = await res.json();
    expect(Array.isArray(reasons)).toBe(true);
  });
});
