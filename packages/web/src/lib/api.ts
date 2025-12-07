// packages/web/src/lib/api.ts

const API_BASE = '/api';

export interface WorkCenter {
  id: number;
  name: string;
  type: string;
  status: 'running' | 'idle' | 'fault' | 'offline';
  green: boolean | null;
  red: boolean | null;
  cycleCount: number | null;
  inputMode: 'auto' | 'manual';
  statusUpdatedBy: string | null;

  // Static specs
  brand: string | null;
  model: string | null;
  tonnage: number | null;
  is2K: boolean | null;

  // Location
  floorRow: 'top' | 'middle' | 'bottom' | null;
  floorPosition: number | null;

  lastSeen: string | null;

  // Active Order Info
  currentOrder: {
    orderNumber: string;
    itemNumber: string;
    itemName: string | null;
    imageUrl: string | null;
    cycleTime: number | null;
    outputQty: number;
    quantityRequired: number;
    quantityCompleted: number;
  } | null;
}

export interface Item {
  itemNumber: string;
  name: string;
  materialType: string;
  uom: string;
  productLine: string | null;
  imageUrl: string | null;
  partWeight: number | null;
  runnerWeight: number | null;
  isActive: boolean;
  compatibleWorkCenters?: string[];
  workCenterIds?: number[];
}

export interface Summary {
  total: number;
  running: number;
  idle: number;
  fault: number;
  offline: number;
  totalCycles: number;
}

export async function fetchWorkCenters(): Promise<WorkCenter[]> {
  const res = await fetch(`${API_BASE}/work-centers`);
  if (!res.ok) throw new Error('Failed to fetch work centers');
  return res.json();
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/reference/items`);
  if (!res.ok) throw new Error('Failed to fetch items');
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
