// packages/api/src/index.test.ts

import { describe, expect, it } from 'bun:test';
import { app } from './index';

const API_KEY = process.env.ESP32_API_KEY || 'dev-esp32-key';

describe('Health Check', () => {
  it('should return ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });
});

describe('Machine API', () => {
  it('GET /api/machines should return array', async () => {
    const res = await app.request('/api/machines');
    expect(res.status).toBe(200);

    const machines = await res.json();
    expect(Array.isArray(machines)).toBe(true);
  });

  it('GET /api/summary should return counts', async () => {
    const res = await app.request('/api/summary');
    expect(res.status).toBe(200);

    const summary = await res.json();
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('running');
    expect(summary).toHaveProperty('idle');
    expect(summary).toHaveProperty('fault');
    expect(summary).toHaveProperty('offline');
  });
});

describe('Status API (ESP32)', () => {
  it('should reject without API key', async () => {
    const res = await app.request('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId: 99,
        machineName: 'TEST',
        status: 'running',
        green: true,
        red: false,
        cycleCount: 0,
      }),
    });
    expect(res.status).toBe(401);
  });

  it('should accept with valid API key', async () => {
    const res = await app.request('/api/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        machineId: 99,
        machineName: 'TEST',
        status: 'running',
        green: true,
        red: false,
        cycleCount: 100,
      }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);
  });
});

describe('Auth API', () => {
  it('should reject invalid login', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('should require auth for /api/auth/me', async () => {
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Orders API', () => {
  it('GET /api/orders should return array', async () => {
    const res = await app.request('/api/orders');
    expect(res.status).toBe(200);

    const orders = await res.json();
    expect(Array.isArray(orders)).toBe(true);
  });

  it('POST /api/orders should require auth', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: 'TEST-001',
        partNumber: 'TEST-PART',
        quantityRequired: 100,
      }),
    });
    expect(res.status).toBe(401);
  });
});
