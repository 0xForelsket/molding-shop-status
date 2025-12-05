// packages/web/src/lib/api.ts

const API_BASE = '/api';

export interface Machine {
  machineId: number;
  machineName: string;
  status: 'running' | 'idle' | 'fault' | 'offline';
  green: boolean | null;
  red: boolean | null;
  cycleCount: number | null;
  inputMode: 'auto' | 'manual';
  statusUpdatedBy: string | null;
  productionOrder: string | null;
  partNumber: string | null;
  partName: string | null;
  targetCycleTime: number | null;
  partsPerCycle: number | null;
  brand: string | null;
  model: string | null;
  tonnage: number | null;
  is2K: boolean | null;
  lastSeen: string | null;
  secondsSinceSeen: number | null;
}

export interface Summary {
  total: number;
  running: number;
  idle: number;
  fault: number;
  offline: number;
  totalCycles: number;
}

export async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch(`${API_BASE}/machines`);
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json();
}

export async function fetchSummary(): Promise<Summary> {
  const res = await fetch(`${API_BASE}/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Login failed');
  }
  return res.json();
}
