// packages/api/src/routes/molds.test.ts
import { describe, expect, test } from 'bun:test';
import { app } from '../index';

describe('Molds Routes', () => {
  describe('GET /api/molds', () => {
    test('returns list of molds', async () => {
      const res = await app.request('/api/molds');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/molds/:id', () => {
    test('returns 404 for non-existent mold', async () => {
      const res = await app.request('/api/molds/NON-EXISTENT-MOLD-ID');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/molds', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/molds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'TEST-MOLD-001',
          name: 'Test Mold',
          cavities: 4,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/molds/:id', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/molds/TEST-MOLD', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cavities: 8 }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/molds/:id', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/molds/TEST-MOLD', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });
  });
});
