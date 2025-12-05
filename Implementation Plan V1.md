# Machine Status Dashboard - Implementation Plan V1

> **Modernized Stack**: Bun, Drizzle ORM, Hono, React + Vite

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Bun | Package manager, runtime, bundler |
| **Backend** | Hono | Ultrafast web framework |
| **ORM** | Drizzle | Type-safe database access |
| **Database** | PostgreSQL | Production database |
| **Frontend** | React 19 + Vite | Modern SPA dashboard |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **UI Components** | Shadcn/ui | Accessible component library |
| **Data Fetching** | TanStack Query | Caching & real-time updates |
| **Validation** | Zod | Shared schema validation |
| **Real-time** | Server-Sent Events (SSE) | Live status updates |

---

## Phase 1: Bill of Materials

### System Architecture
![System Architecture](assets/system_architecture.png)

### Per Machine (×18)

![Enclosure Layout](assets/enclosure_layout.png)

| Item | Qty | Unit Cost | Notes |
|------|-----|-----------|-------|
| ESP32-WROOM-32 dev board | 1 | $5-8 | NodeMCU-32S or similar |
| 4-channel optocoupler module (PC817) | 1 | $1-2 | Isolates 24V from ESP32 (Usually has built-in resistors) |
| 1kΩ resistors (Optional) | 3 | $0.10 | Only needed if module doesn't have them built-in |
| Small project enclosure | 1 | $3-5 | IP65 if near coolant/oil |
| 5V buck converter (mini) | 1 | $1-2 | MP1584 or similar, 24V→5V |
| Terminal blocks or Wago connectors | 1 set | $2 | Clean connections |
| Wire (22-24 AWG stranded) | ~3m | $1 | Signal runs to stack light |

**Per-machine cost: ~$15-25**

### Central System (×1)

| Item | Qty | Cost | Notes |
|------|-----|------|-------|
| Raspberry Pi 4 (2GB+) | 1 | $45-60 | Or any PC you have lying around |
| MicroSD card (32GB) | 1 | $8 | |
| 43-55" TV or monitor | 1 | $250-400 | Commercial preferred for brightness |
| WiFi access point (if needed) | 1 | $30-50 | Needs coverage across shop floor |

---

## Phase 2: Wiring Design

### Stack Light Basics

Your stack lights are almost certainly 24VDC. The tower typically has:
- **Common wire** (usually 24V+ or 0V, varies by manufacturer)
- **Individual wire per color** (red, yellow, green, sometimes blue/white)

Tap **green** (running) and **red** (fault). Yellow (idle) is inferred from absence of green.

### Wiring Diagram

![ESP32 Wiring Diagram](assets/esp32_wiring_diagram.png)

> **Note on Resistors**: The diagram above shows a **Module** (green board). These usually have the 1kΩ resistors **built-in** (tiny black rectangles). If you buy the module, you don't need to add extra resistors. The text diagram below shows the logical connection.

#### The "Eyes vs. Food" Concept
*   **Top Path (Optocoupler) = The Eyes**: It watches the 24V light signals and tells the ESP32 what's happening. It keeps the dangerous 24V away from the ESP32.
*   **Bottom Path (Buck Converter) = The Food**: It takes 24V power and turns it into 5V to keep the ESP32 alive 24/7.

```
STACK LIGHT WIRING                         ESP32
─────────────────                         ──────

  24V Common ────────┬─────────────────────────────┐
                     │                             │
                     │    ┌──────────────────┐     │
  Green wire ────────┼───►│ 1kΩ    PC817    │     │
                     │    │  ┌─┐   ┌─────┐  │     │
                     │    └──┤R├───┤►│   ├──┼─────┼──► GPIO 34
                     │       └─┘   │ LED │  │     │
                     │             └─────┘  │     │
                     │                      │     │
  Red wire ──────────┼───►│ 1kΩ    PC817    │     │
                     │    │  ┌─┐   ┌─────┐  │     │
                     │    └──┤R├───┤►│   ├──┼─────┼──► GPIO 35
                     │       └─┘   │ LED │  │     │
                     │             └─────┘  │     │
  0V Common ─────────┴─────────────────────────────┴──► GND


  24V ──────► [Buck Converter 24V→5V] ──────► ESP32 VIN
  0V  ──────►                          ──────► ESP32 GND
```

### Key Points

1. **Find the common** - Use a multimeter to check if common-positive or common-negative
2. **Optocoupler wiring** - PC817: LED side (24V), transistor side (3.3V). 1kΩ limits to ~20mA
3. **ESP32 input pins** - GPIO 34, 35, 36, 39 (input-only). Enable pullups or use module's built-in

---

## Phase 3: ESP32 Firmware

```cpp
// machine_monitor.ino

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
const char* WIFI_SSID = "YourPlantWiFi";
const char* WIFI_PASSWORD = "YourPassword";
const char* SERVER_URL = "http://192.168.1.100:3000/api/status";

// Unique ID for this machine - change for each ESP32
const int MACHINE_ID = 1;
const char* MACHINE_NAME = "Haitian 1";

// Pin assignments
const int PIN_GREEN = 34;  // Running
const int PIN_RED = 35;    // Fault

// Timing
const unsigned long SEND_INTERVAL_MS = 5000;
const unsigned long CYCLE_DEBOUNCE_MS = 500;
const unsigned long WIFI_RETRY_INTERVAL = 30000;

// ============== STATE ==============
bool lastGreenState = false;
bool lastRedState = false;
unsigned long lastSendTime = 0;
unsigned long lastCycleTime = 0;
unsigned long cycleCount = 0;
bool wifiConnected = false;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_GREEN, INPUT);
  pinMode(PIN_RED, INPUT);
  connectWiFi();
}

void connectWiFi() {
  Serial.printf("Connecting to %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  wifiConnected = (WiFi.status() == WL_CONNECTED);
  if (wifiConnected) {
    Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connection failed, will retry...");
  }
}

String getStatus(bool green, bool red) {
  if (red) return "fault";
  if (green) return "running";
  return "idle";
}

void sendStatus(bool green, bool red) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["machineId"] = MACHINE_ID;
  doc["machineName"] = MACHINE_NAME;
  doc["status"] = getStatus(green, red);
  doc["green"] = green;
  doc["red"] = red;
  doc["cycleCount"] = cycleCount;
  doc["uptimeSec"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  
  int responseCode = http.POST(json);
  Serial.printf("Sent: %s (response: %d)\n", json.c_str(), responseCode);
  http.end();
}

void loop() {
  unsigned long now = millis();
  
  // Reconnect WiFi if needed
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > WIFI_RETRY_INTERVAL) {
      lastWifiRetry = now;
      connectWiFi();
    }
  }
  
  // Read current state (inverted - optocoupler pulls low when active)
  bool greenOn = digitalRead(PIN_GREEN) == LOW;
  bool redOn = digitalRead(PIN_RED) == LOW;
  
  // Detect cycle completion (green turning ON after OFF)
  if (greenOn && !lastGreenState) {
    if (now - lastCycleTime > CYCLE_DEBOUNCE_MS) {
      cycleCount++;
      lastCycleTime = now;
      Serial.printf("Cycle detected! Total: %lu\n", cycleCount);
    }
  }
  
  // Send on state change OR periodic interval
  bool stateChanged = (greenOn != lastGreenState) || (redOn != lastRedState);
  bool timeToSend = (now - lastSendTime) >= SEND_INTERVAL_MS;
  
  if (stateChanged || timeToSend) {
    sendStatus(greenOn, redOn);
    lastSendTime = now;
  }
  
  lastGreenState = greenOn;
  lastRedState = redOn;
  delay(100);  // Poll at 10Hz
}
```

---

## Phase 4: Project Structure

```
molding-shop-status/
├── packages/
│   ├── api/                      # Hono backend
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # Drizzle schema
│   │   │   │   ├── index.ts      # DB connection
│   │   │   │   └── migrations/
│   │   │   ├── routes/
│   │   │   │   ├── machines.ts
│   │   │   │   └── status.ts
│   │   │   └── index.ts          # Hono app entry
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   └── web/                      # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── MachineCard.tsx
│       │   │   ├── SummaryBar.tsx
│       │   │   └── Dashboard.tsx
│       │   ├── hooks/
│       │   │   └── useMachines.ts
│       │   ├── lib/
│       │   │   └── api.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       └── package.json
│
├── firmware/                     # ESP32 Arduino code
│   └── machine_monitor/
│       └── machine_monitor.ino
│
├── package.json                  # Workspace root
├── bun.lockb
└── .env.example
```

---

## Phase 5: Database Schema (Drizzle ORM)

```typescript
// packages/api/src/db/schema.ts

import { pgTable, serial, integer, text, boolean, real, timestamp } from 'drizzle-orm/pg-core';

export const machines = pgTable('machines', {
  machineId: serial('machine_id').primaryKey(),
  machineName: text('machine_name').notNull(),
  status: text('status').default('offline').notNull(),  // 'running', 'idle', 'fault', 'offline'
  green: boolean('green').default(false),
  red: boolean('red').default(false),
  cycleCount: integer('cycle_count').default(0),
  
  // Input Mode: 'auto' (ESP32 signal) or 'manual' (line leader input)
  inputMode: text('input_mode').default('auto').notNull(),  // 'auto' or 'manual'
  statusUpdatedBy: text('status_updated_by'),  // Name of person who updated (for manual mode)
  
  // Production Order Details (editable per shift)
  productionOrder: text('production_order'),
  partNumber: text('part_number'),           // e.g. MD-12345
  partName: text('part_name'),               // e.g. "Comb Holder BT 9"
  targetCycleTime: real('target_cycle_time'), // seconds
  partsPerCycle: integer('parts_per_cycle').default(1),
  
  // Machine Specifications (static, for reference/filtering)
  brand: text('brand'),                      // HAITIAN, ZHAFIR, ENGEL
  model: text('model'),                      // MA1600II, VE2300III, etc.
  serialNo: text('serial_no'),
  tonnage: integer('tonnage'),               // 60, 90, 120, 160, etc.
  screwDiameter: real('screw_diameter'),     // mm
  injectionWeight: real('injection_weight'), // grams
  is2K: boolean('is_2k').default(false),
  
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const statusLogs = pgTable('status_logs', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  status: text('status').notNull(),
  cycleCount: integer('cycle_count'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Parts Catalog - each part is unique
export const parts = pgTable('parts', {
  partNumber: text('part_number').primaryKey(),  // e.g. "147933-00"
  partName: text('part_name').notNull(),         // e.g. "Lower Housing USB Dry"
  productLine: text('product_line'),             // e.g. "Wave 1.1", "Kepler BT-9"
  createdAt: timestamp('created_at').defaultNow(),
});

// Which parts can run on which machines (with machine-specific settings)
export const machineParts = pgTable('machine_parts', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  partNumber: text('part_number')
    .references(() => parts.partNumber)
    .notNull(),
  cavityPlan: integer('cavity_plan').default(1),     // how many parts per shot
  targetCycleTime: real('target_cycle_time'),        // expected cycle time in seconds
});

// Production Orders - what needs to be made
export const productionOrders = pgTable('production_orders', {
  orderNumber: text('order_number').primaryKey(),    // e.g. "1354981"
  partNumber: text('part_number')
    .references(() => parts.partNumber)
    .notNull(),
  quantityRequired: integer('quantity_required').notNull(),
  quantityCompleted: integer('quantity_completed').default(0),
  
  // Assignment
  machineId: integer('machine_id')
    .references(() => machines.machineId),
  
  // Status: 'pending', 'assigned', 'running', 'completed', 'cancelled'
  status: text('status').default('pending'),
  
  // Timestamps
  dueDate: timestamp('due_date'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Shifts - Day and Night
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),           // "Day Shift", "Night Shift"
  startTime: text('start_time').notNull(), // "07:00"
  endTime: text('end_time').notNull(),     // "19:00"
  isActive: boolean('is_active').default(true),
});

// Downtime Reasons - for tracking why machines are idle
export const downtimeReasons = pgTable('downtime_reasons', {
  code: text('code').primaryKey(),        // "MOLD_CHANGE"
  name: text('name').notNull(),           // "Mold Change"
  category: text('category').notNull(),   // "planned" or "unplanned"
  isActive: boolean('is_active').default(true),
});

// Downtime Logs - when a machine goes idle with a reason
export const downtimeLogs = pgTable('downtime_logs', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  reasonCode: text('reason_code')
    .references(() => downtimeReasons.code)
    .notNull(),
  shiftId: integer('shift_id')
    .references(() => shifts.id),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  durationMinutes: integer('duration_minutes'),
});

// Product Lines - for filtering/reporting
export const productLines = pgTable('product_lines', {
  code: text('code').primaryKey(),        // "WAVE_1_1"
  name: text('name').notNull(),           // "Wave 1.1"
  isActive: boolean('is_active').default(true),
});

// Users - for authentication and tracking who made changes
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),    // null for first login
  name: text('name').notNull(),
  role: text('role').notNull(),           // "admin", "planner", "line_leader", "viewer"
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// Type exports for use throughout the app
export type Machine = typeof machines.$inferSelect;
export type NewMachine = typeof machines.$inferInsert;
export type StatusLog = typeof statusLogs.$inferSelect;
export type Part = typeof parts.$inferSelect;
export type MachinePart = typeof machineParts.$inferSelect;
export type ProductionOrder = typeof productionOrders.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type DowntimeReason = typeof downtimeReasons.$inferSelect;
export type DowntimeLog = typeof downtimeLogs.$inferSelect;
export type ProductLine = typeof productLines.$inferSelect;
export type User = typeof users.$inferSelect;

```typescript
// packages/api/src/db/index.ts

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

---

## Phase 6: Authentication & Authorization

### Authentication Strategy

The system uses a **dual authentication approach**:

1. **API Key** for ESP32 devices (simple, stateless)
2. **JWT tokens** for dashboard users (session-based)

### Environment Variables

```bash
# Add to .env
ESP32_API_KEY=your-secure-esp32-key-here
JWT_SECRET=your-secure-jwt-secret-32-chars-min
JWT_EXPIRES_IN=24h
```

### Auth Middleware

```typescript
// packages/api/src/middleware/auth.ts

import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

const ESP32_API_KEY = process.env.ESP32_API_KEY || 'dev-esp32-key';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod';

// Middleware for ESP32 status reports (API key auth)
export async function esp32Auth(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey || apiKey !== ESP32_API_KEY) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }
  
  await next();
}

// Middleware for dashboard users (JWT auth)
export async function jwtAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = await verify(token, JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// Role-based access control
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    
    await next();
  };
}
```

### Login Endpoint

```typescript
// packages/api/src/routes/auth.ts

import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const authRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');
  
  const user = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  
  if (user.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  // First login: password hash is null, allow any password and set it
  if (user[0].passwordHash === null) {
    // Hash and save the password (using Bun's built-in hasher)
    const hash = await Bun.password.hash(password);
    await db.update(users)
      .set({ passwordHash: hash, lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user[0].id));
  } else {
    // Verify password
    const valid = await Bun.password.verify(password, user[0].passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user[0].id));
  }
  
  // Generate JWT
  const token = await sign({
    sub: user[0].id,
    username: user[0].username,
    role: user[0].role,
    name: user[0].name,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  }, JWT_SECRET);
  
  return c.json({
    token,
    user: {
      id: user[0].id,
      username: user[0].username,
      name: user[0].name,
      role: user[0].role,
    },
  });
});

// Get current user info
authRoutes.get('/me', jwtAuth, async (c) => {
  const payload = c.get('user');
  return c.json(payload);
});

export { authRoutes };
```

### ESP32 Firmware Update (add API key)

```cpp
// In machine_monitor.ino - add API key to sendStatus()

const char* API_KEY = "your-secure-esp32-key-here";  // Same as ESP32_API_KEY in .env

void sendStatus(bool green, bool red) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);  // <-- Add this line
  
  // ... rest of function
}
```

---

## Phase 7: Error Handling

### Global Error Handler

```typescript
// packages/api/src/middleware/error-handler.ts

import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export function errorHandler(err: Error, c: Context) {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);
  
  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: 'Validation failed',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    }, 400);
  }
  
  // HTTP exceptions (thrown intentionally)
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  
  // Database errors
  if (err.message?.includes('duplicate key')) {
    return c.json({ error: 'Resource already exists' }, 409);
  }
  
  if (err.message?.includes('violates foreign key')) {
    return c.json({ error: 'Referenced resource not found' }, 400);
  }
  
  // Unknown errors - don't leak details in production
  const isDev = process.env.NODE_ENV !== 'production';
  return c.json({
    error: 'Internal server error',
    ...(isDev && { message: err.message, stack: err.stack }),
  }, 500);
}
```

### Database Operation Wrapper

```typescript
// packages/api/src/lib/db-utils.ts

import { Context } from 'hono';

// Wrapper for database operations with consistent error handling
export async function dbOperation<T>(
  c: Context,
  operation: () => Promise<T>,
  errorMessage = 'Database operation failed'
): Promise<T | Response> {
  try {
    return await operation();
  } catch (err) {
    console.error(`[DB Error] ${errorMessage}:`, err);
    throw err; // Re-throw for global error handler
  }
}
```

### Apply to Main App

```typescript
// packages/api/src/index.ts (updated)

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/error-handler';
import { esp32Auth, jwtAuth, requireRole } from './middleware/auth';
import { authRoutes } from './routes/auth';

const app = new Hono();

// Global middleware
app.use('*', logger());  // Request logging
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Global error handler
app.onError(errorHandler);

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth routes (no auth required)
app.route('/api/auth', authRoutes);

// ESP32 status endpoint (API key auth)
app.post('/api/status', esp32Auth, /* ... handler ... */);

// Dashboard routes (JWT auth for writes)
app.get('/api/machines', /* ... public read ... */);
app.post('/api/machines/:id/config', jwtAuth, requireRole('admin', 'planner'), /* ... */);
app.post('/api/machines/:id/manual-status', jwtAuth, requireRole('admin', 'line_leader'), /* ... */);
// ... etc
```

---

## Phase 8: Backend API (Hono)

```typescript
// packages/api/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { machines, statusLogs } from './db/schema';

const app = new Hono();

app.use('*', cors());

// Validation schema (shared with frontend via package)
const statusUpdateSchema = z.object({
  machineId: z.number(),
  machineName: z.string(),
  status: z.enum(['running', 'idle', 'fault', 'offline']),
  green: z.boolean(),
  red: z.boolean(),
  cycleCount: z.number(),
  uptimeSec: z.number().optional(),
});

// Update machine configuration (Manual Input)
const machineConfigSchema = z.object({
  machineId: z.number(),
  productionOrder: z.string().optional(),
  partName: z.string().optional(),
  targetCycleTime: z.number().optional(),
  partsPerCycle: z.number().default(1),
});

app.post('/api/machines/:id/config', zValidator('json', machineConfigSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  
  await db.update(machines)
    .set({
      productionOrder: data.productionOrder,
      partName: data.partName,
      targetCycleTime: data.targetCycleTime,
      partsPerCycle: data.partsPerCycle,
    })
    .where(eq(machines.machineId, id));
    
  return c.json({ success: true });
});

// Bulk update endpoint for the table view
app.post('/api/machines/bulk-update', zValidator('json', z.array(machineConfigSchema)), async (c) => {
  const updates = c.req.valid('json');
  
  // Run in transaction
  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx.update(machines)
        .set({
          productionOrder: update.productionOrder,
          partName: update.partName,
          targetCycleTime: update.targetCycleTime,
          partsPerCycle: update.partsPerCycle,
        })
        .where(eq(machines.machineId, update.machineId));
    }
  });
    
  return c.json({ success: true, count: updates.length });
});

// ============== MANUAL STATUS UPDATE (for line leaders) ==============

const manualStatusSchema = z.object({
  status: z.enum(['running', 'idle', 'fault', 'offline']),
  updatedBy: z.string().min(1),  // Line leader name
  cycleCount: z.number().optional(),
});

// Manual status update (only works if machine is in 'manual' mode)
app.post('/api/machines/:id/manual-status', zValidator('json', manualStatusSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  
  // Check if machine is in manual mode
  const machine = await db.select()
    .from(machines)
    .where(eq(machines.machineId, id))
    .limit(1);
  
  if (machine.length === 0) {
    return c.json({ error: 'Machine not found' }, 404);
  }
  
  if (machine[0].inputMode !== 'manual') {
    return c.json({ error: 'Machine is in auto mode. Change to manual mode first.' }, 400);
  }
  
  await db.update(machines)
    .set({
      status: data.status,
      statusUpdatedBy: data.updatedBy,
      cycleCount: data.cycleCount ?? machine[0].cycleCount,
      lastSeen: new Date().toISOString(),
    })
    .where(eq(machines.machineId, id));
  
  // Log the status change
  await db.insert(statusLogs).values({
    machineId: id,
    status: data.status,
    cycleCount: data.cycleCount ?? machine[0].cycleCount,
  });
  
  return c.json({ success: true });
});

// Toggle input mode (auto <-> manual)
app.post('/api/machines/:id/input-mode', async (c) => {
  const id = parseInt(c.req.param('id'));
  const { mode } = await c.req.json();
  
  if (!['auto', 'manual'].includes(mode)) {
    return c.json({ error: 'Invalid mode' }, 400);
  }
  
  await db.update(machines)
    .set({ inputMode: mode })
    .where(eq(machines.machineId, id));
  
  return c.json({ success: true, mode });
});

// ============== PRODUCTION ORDERS ==============

const productionOrderSchema = z.object({
  orderNumber: z.string().min(1),
  partNumber: z.string().min(1),
  quantityRequired: z.number().positive(),
  dueDate: z.string().optional(),
});

// Get all production orders
app.get('/api/orders', async (c) => {
  const orders = await db
    .select()
    .from(productionOrders)
    .leftJoin(parts, eq(productionOrders.partNumber, parts.partNumber))
    .leftJoin(machines, eq(productionOrders.machineId, machines.machineId))
    .orderBy(productionOrders.createdAt);
  
  return c.json(orders);
});

// Create single production order (with duplicate check)
app.post('/api/orders', zValidator('json', productionOrderSchema), async (c) => {
  const data = c.req.valid('json');
  
  // Check for duplicate order number
  const existing = await db.select()
    .from(productionOrders)
    .where(eq(productionOrders.orderNumber, data.orderNumber))
    .limit(1);
  
  if (existing.length > 0) {
    return c.json({ error: `Order ${data.orderNumber} already exists` }, 409);
  }
  
  await db.insert(productionOrders).values({
    orderNumber: data.orderNumber,
    partNumber: data.partNumber,
    quantityRequired: data.quantityRequired,
    dueDate: data.dueDate,
  });
  
  return c.json({ success: true, orderNumber: data.orderNumber });
});

// Bulk import production orders (for Excel paste)
// Accepts TSV (tab-separated values) or JSON array
app.post('/api/orders/bulk-import', async (c) => {
  const contentType = c.req.header('Content-Type');
  let orders: { orderNumber: string; partNumber: string; quantity: number }[] = [];
  
  if (contentType?.includes('text/plain')) {
    // Parse TSV from Excel paste (Order#, Part#, Quantity)
    const text = await c.req.text();
    const lines = text.trim().split('\n');
    
    for (const line of lines) {
      const [orderNumber, partNumber, quantityStr] = line.split('\t').map(s => s.trim());
      if (orderNumber && partNumber && quantityStr) {
        orders.push({
          orderNumber,
          partNumber,
          quantity: parseInt(quantityStr, 10),
        });
      }
    }
  } else {
    // JSON array
    orders = await c.req.json();
  }
  
  if (orders.length === 0) {
    return c.json({ error: 'No valid orders to import' }, 400);
  }
  
  // Check for duplicates in database
  const existingOrders = await db.select({ orderNumber: productionOrders.orderNumber })
    .from(productionOrders)
    .where(inArray(productionOrders.orderNumber, orders.map(o => o.orderNumber)));
  
  const existingSet = new Set(existingOrders.map(o => o.orderNumber));
  const duplicates = orders.filter(o => existingSet.has(o.orderNumber));
  const newOrders = orders.filter(o => !existingSet.has(o.orderNumber));
  
  // Also check for duplicates within the import itself
  const seenInImport = new Set<string>();
  const duplicatesInImport: string[] = [];
  
  for (const order of newOrders) {
    if (seenInImport.has(order.orderNumber)) {
      duplicatesInImport.push(order.orderNumber);
    }
    seenInImport.add(order.orderNumber);
  }
  
  // Insert valid orders
  const uniqueOrders = newOrders.filter(
    o => !duplicatesInImport.includes(o.orderNumber)
  );
  
  if (uniqueOrders.length > 0) {
    await db.insert(productionOrders).values(
      uniqueOrders.map(o => ({
        orderNumber: o.orderNumber,
        partNumber: o.partNumber,
        quantityRequired: o.quantity,
      }))
    );
  }
  
  return c.json({
    imported: uniqueOrders.length,
    skippedDuplicates: duplicates.map(o => o.orderNumber),
    duplicatesInImport,
  });
});

// Assign order to machine
app.post('/api/orders/:orderNumber/assign', async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const { machineId } = await c.req.json();
  
  await db.update(productionOrders)
    .set({ 
      machineId,
      status: 'assigned',
    })
    .where(eq(productionOrders.orderNumber, orderNumber));
  
  return c.json({ success: true });
});

// Update order status
app.patch('/api/orders/:orderNumber', async (c) => {
  const orderNumber = c.req.param('orderNumber');
  const updates = await c.req.json();
  
  await db.update(productionOrders)
    .set(updates)
    .where(eq(productionOrders.orderNumber, orderNumber));
  
  return c.json({ success: true });
});

// Receive status from ESP32
app.post('/api/status', zValidator('json', statusUpdateSchema), async (c) => {
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  await db
    .insert(machines)
    .values({
      machineId: data.machineId,
      machineName: data.machineName,
      status: data.status,
      green: data.green,
      red: data.red,
      cycleCount: data.cycleCount,
      lastSeen: now,
    })
    .onConflictDoUpdate({
      target: machines.machineId,
      set: {
        machineName: data.machineName,
        status: data.status,
        green: data.green,
        red: data.red,
        cycleCount: data.cycleCount,
        lastSeen: now,
      },
    });

  // Log status
  await db.insert(statusLogs).values({
    machineId: data.machineId,
    status: data.status,
    cycleCount: data.cycleCount,
  });

  return c.json({ received: true });
});

// Get all machines
app.get('/api/machines', async (c) => {
  const allMachines = await db.select().from(machines).orderBy(machines.machineId);
  
  const now = Date.now();
  const result = allMachines.map((m) => {
    const lastSeenMs = m.lastSeen ? new Date(m.lastSeen).getTime() : null;
    const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : null;
    
    return {
      ...m,
      status: secondsSinceSeen && secondsSinceSeen > 30 ? 'offline' : m.status,
      secondsSinceSeen,
    };
  });

  return c.json(result);
});

// Get summary counts
app.get('/api/summary', async (c) => {
  const allMachines = await db.select().from(machines);
  
  const now = Date.now();
  const statuses = allMachines.map((m) => {
    const lastSeenMs = m.lastSeen ? new Date(m.lastSeen).getTime() : null;
    const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : null;
    return secondsSinceSeen && secondsSinceSeen > 30 ? 'offline' : m.status;
  });

  return c.json({
    total: allMachines.length,
    running: statuses.filter((s) => s === 'running').length,
    idle: statuses.filter((s) => s === 'idle').length,
    fault: statuses.filter((s) => s === 'fault').length,
    offline: statuses.filter((s) => s === 'offline').length,
    totalCycles: allMachines.reduce((sum, m) => sum + (m.cycleCount ?? 0), 0),
  });
});

// SSE endpoint for real-time updates (with proper cleanup)
app.get('/api/events', async (c) => {
  // Create AbortController tied to the request
  const abortController = new AbortController();
  
  // Cleanup when client disconnects
  c.req.raw.signal.addEventListener('abort', () => {
    abortController.abort();
    console.log('[SSE] Client disconnected');
  });
  
  return c.streamSSE(async (stream) => {
    try {
      while (!abortController.signal.aborted) {
        const allMachines = await db.select().from(machines);
        
        // Check again before writing (client may have disconnected during query)
        if (abortController.signal.aborted) break;
        
        await stream.writeSSE({ 
          event: 'machines',
          data: JSON.stringify(allMachines) 
        });
        
        // Use AbortSignal-aware sleep
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 2000);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            resolve(undefined);
          }, { once: true });
        });
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('[SSE] Error:', err);
      }
    } finally {
      console.log('[SSE] Stream closed');
    }
  });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

---

## Phase 9: Frontend (React + Vite)

![Dashboard UI Mockup - Light Mode](assets/dashboard_light_mode.png)

### Setup

```bash
cd packages
bun create vite web --template react-ts
cd web
bun add @tanstack/react-query @tanstack/react-query-devtools @tanstack/react-table
bun add -D tailwindcss @tailwindcss/vite
```

### Main App

```tsx
// packages/web/src/App.tsx

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MachineCard } from './components/MachineCard';
import { SummaryBar } from './components/SummaryBar';
import { MachineTable } from './components/MachineTable'; // New component
import { Button } from './components/ui/button'; // Shadcn UI

const queryClient = new QueryClient();

function Dashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const { data: machines = [] } = useQuery({
    queryKey: ['machines'],
    queryFn: () => fetch('/api/machines').then((r) => r.json()),
    refetchInterval: 2000,
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => fetch('/api/summary').then((r) => r.json()),
    refetchInterval: 2000,
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
        <h1 className="text-2xl font-semibold">Injection Molding - Machine Status</h1>
        
        <div className="flex gap-4 items-center">
            {summary && <SummaryBar summary={summary} />}
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
                >
                    Grid
                </button>
                <button 
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
                >
                    Manage
                </button>
            </div>
        </div>
        
        <time className="text-slate-400 text-lg">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {machines.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
            ))}
        </div>
      ) : (
        <MachineTable machines={machines} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
```

### Machine Card Component

```tsx
// packages/web/src/components/MachineCard.tsx

import { cn } from '../lib/utils';

interface Machine {
  machineId: number;
  machineName: string;
  status: 'running' | 'idle' | 'fault' | 'offline';
  cycleCount: number;
  secondsSinceSeen: number | null;
  productionOrder?: string;
  partNumber?: string;
  partName?: string;
  targetCycleTime?: number;
}

const statusStyles = {
  running: 'border-green-500 bg-gradient-to-br from-slate-800 to-green-950',
  idle: 'border-yellow-500 bg-gradient-to-br from-slate-800 to-yellow-950',
  fault: 'border-red-500 bg-gradient-to-br from-slate-800 to-red-950 animate-pulse',
  offline: 'border-slate-600 opacity-60',
};

const statusTextColors = {
  running: 'text-green-400',
  idle: 'text-yellow-400',
  fault: 'text-red-400',
  offline: 'text-slate-500',
};

function formatLastSeen(seconds: number | null): string {
  if (seconds === null) return 'Never';
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function MachineCard({ machine }: { machine: Machine }) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 text-center border-2 transition-transform hover:-translate-y-0.5 hover:shadow-xl',
        statusStyles[machine.status]
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{machine.machineName}</h2>
          <p className="text-sm opacity-80">{machine.productionOrder || 'No Order'}</p>
        </div>
        <div className={cn('px-2 py-1 rounded text-xs font-bold uppercase', statusTextColors[machine.status])}>
          {machine.status}
        </div>
      </div>
      
      <div className="space-y-2 text-left">
        <div className="flex justify-between">
          <span className="text-slate-400">Part #:</span>
          <span className="font-mono">{machine.partNumber || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Part:</span>
          <span className="font-medium truncate max-w-[150px]">{machine.partName || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Cycle Time:</span>
          <span>
            <span className="font-mono text-lg">{calculateAverageCycleTime(machine)}s</span>
            {machine.targetCycleTime && (
              <span className="text-xs text-slate-500 ml-1">/ {machine.targetCycleTime}s</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">OEE:</span>
          <span className={getOEEColor(machine)}>{calculateOEE(machine)}%</span>
        </div>
      </div>
      
      {/* Hidden 'Edit' button that appears on hover for supervisors */}
      <button className="absolute top-2 right-2 opacity-0 hover:opacity-100 p-1 bg-slate-700 rounded">
        ✏️
      </button>
    </div>
  );
}

// ============== HELPER FUNCTIONS ==============

// Calculate average cycle time from recent cycles
// In production, this would use actual cycle data from the backend
function calculateAverageCycleTime(machine: Machine): string {
  // If we have target cycle time, use it as a baseline with slight variance
  if (machine.targetCycleTime) {
    // Simulate actual cycle time being close to target (±10%)
    const variance = (Math.random() - 0.5) * 0.2;
    const actual = machine.targetCycleTime * (1 + variance);
    return actual.toFixed(1);
  }
  return '--';
}

// Calculate OEE (Overall Equipment Effectiveness)
// OEE = Availability × Performance × Quality
// Simplified version based on available data
function calculateOEE(machine: Machine): number {
  // If offline or fault, OEE is 0
  if (machine.status === 'offline' || machine.status === 'fault') {
    return 0;
  }
  
  // If idle, reduced OEE
  if (machine.status === 'idle') {
    return 25; // Machine available but not producing
  }
  
  // If running, calculate based on cycle time performance
  if (machine.targetCycleTime) {
    const actualCycleTime = parseFloat(calculateAverageCycleTime(machine));
    if (!isNaN(actualCycleTime)) {
      // Performance ratio (target / actual, capped at 100%)
      const performance = Math.min(machine.targetCycleTime / actualCycleTime, 1);
      // Assume 95% availability for running machines, 99% quality
      const oee = 0.95 * performance * 0.99 * 100;
      return Math.round(oee);
    }
  }
  
  // Default for running machines without target data
  return 85;
}

// Get color class based on OEE percentage
function getOEEColor(machine: Machine): string {
  const oee = calculateOEE(machine);
  
  if (oee >= 85) return 'text-green-400 font-bold';   // World-class
  if (oee >= 65) return 'text-yellow-400';            // Typical
  if (oee >= 40) return 'text-orange-400';            // Needs improvement
  return 'text-red-400';                              // Poor
}
```

### Order Import Component (Excel Paste)

```tsx
// packages/web/src/components/OrderImport.tsx

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ImportResult {
  imported: number;
  skippedDuplicates: string[];
  duplicatesInImport: string[];
}

export function OrderImport() {
  const [pasteData, setPasteData] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();
  
  const importMutation = useMutation({
    mutationFn: async (data: string) => {
      const res = await fetch('/api/orders/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: data,
      });
      if (!res.ok) throw new Error('Import failed');
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setPasteData(''); // Clear after success
    },
  });
  
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    setPasteData(text);
  };
  
  const handleImport = () => {
    if (pasteData.trim()) {
      importMutation.mutate(pasteData);
    }
  };
  
  // Preview parsed data
  const previewRows = pasteData
    .trim()
    .split('\n')
    .slice(0, 5) // Show first 5 rows
    .map(line => line.split('\t'));
  
  return (
    <div className="bg-slate-800 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">Import Production Orders</h2>
      
      <p className="text-slate-400 text-sm">
        Copy cells from Excel (Order #, Part #, Quantity) and paste below.
        Duplicate order numbers will be skipped.
      </p>
      
      <textarea
        className="w-full h-32 bg-slate-900 rounded-lg p-3 font-mono text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
        placeholder="Paste from Excel here...&#10;1354981	147933-00	5000&#10;1354982	141927-00	3000"
        value={pasteData}
        onChange={(e) => setPasteData(e.target.value)}
        onPaste={handlePaste}
      />
      
      {/* Preview */}
      {previewRows.length > 0 && previewRows[0].length > 1 && (
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-2">
            Preview ({pasteData.trim().split('\n').length} rows):
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left">Order #</th>
                <th className="text-left">Part #</th>
                <th className="text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i}>
                  <td className="font-mono">{row[0]}</td>
                  <td className="font-mono">{row[1]}</td>
                  <td className="text-right">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pasteData.trim().split('\n').length > 5 && (
            <p className="text-xs text-slate-500 mt-2">
              ... and {pasteData.trim().split('\n').length - 5} more
            </p>
          )}
        </div>
      )}
      
      <button
        onClick={handleImport}
        disabled={!pasteData.trim() || importMutation.isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-medium transition-colors"
      >
        {importMutation.isPending ? 'Importing...' : 'Import Orders'}
      </button>
      
      {/* Results */}
      {result && (
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-green-400">
            ✓ Imported {result.imported} orders
          </p>
          {result.skippedDuplicates.length > 0 && (
            <p className="text-yellow-400">
              ⚠ Skipped {result.skippedDuplicates.length} duplicates: {' '}
              {result.skippedDuplicates.slice(0, 3).join(', ')}
              {result.skippedDuplicates.length > 3 && '...'}
            </p>
          )}
          {result.duplicatesInImport.length > 0 && (
            <p className="text-orange-400">
              ⚠ Duplicate within paste: {result.duplicatesInImport.join(', ')}
            </p>
          )}
        </div>
      )}
      
      {importMutation.isError && (
        <p className="text-red-400">Import failed. Check the data format.</p>
      )}
    </div>
  );
}

### Summary Bar Component

```tsx
// packages/web/src/components/SummaryBar.tsx

interface Summary {
  running: number;
  idle: number;
  fault: number;
  offline: number;
}

export function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <div className="flex gap-4 text-lg">
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-green-500">
        <span className="font-bold">{summary.running}</span> Running
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-yellow-500">
        <span className="font-bold">{summary.idle}</span> Idle
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-red-500">
        <span className="font-bold">{summary.fault}</span> Fault
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-slate-500">
        <span className="font-bold">{summary.offline}</span> Offline
      </div>
    </div>
  );
}
```

---

## Phase 10: Development Setup

### Root package.json (Workspace)

```json
{
  "name": "molding-shop-status",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "dev:api": "bun run --filter api dev",
    "dev:web": "bun run --filter web dev",
    "build": "bun run --filter '*' build",
    "db:generate": "bun run --filter api db:generate",
    "db:migrate": "bun run --filter api db:migrate"
  }
}
```

### API package.json

```json
{
  "name": "api",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "bun run src/db/seeds/run.ts"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-validator": "^0.4.0",
    "drizzle-orm": "^0.35.0",
    "pg": "^8.11.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.26.0",
    "@types/pg": "^8.11.0"
  }
}
```

### Environment Variables

```bash
# .env.example
DATABASE_URL=postgresql://molding:molding_secret@localhost:5432/molding_shop
API_PORT=3000
VITE_API_URL=http://localhost:3000
```

### Seed Files (Existing)

The project includes comprehensive seed data in `packages/api/src/db/seeds/`:

| File | Contents |
|------|----------|
| [machines.ts](file:///home/sdhui/projects/molding-shop-status/packages/api/src/db/seeds/machines.ts) | 18 injection molding machines with specs |
| [parts.ts](file:///home/sdhui/projects/molding-shop-status/packages/api/src/db/seeds/parts.ts) | 109 parts + machine-part capability mappings |
| [reference-data.ts](file:///home/sdhui/projects/molding-shop-status/packages/api/src/db/seeds/reference-data.ts) | Shifts, downtime reasons, product lines, users |
| [run.ts](file:///home/sdhui/projects/molding-shop-status/packages/api/src/db/seeds/run.ts) | Seed runner script |

Run seeds with: `bun run db:seed`

---

## Phase 11: Docker & Deployment

### Quick Start (Development)

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies
bun install

# 4. Run database migrations
bun run db:migrate

# 5. Seed initial data (machines + parts)
bun run db:seed

# 6. Start development servers
bun run dev
```

### Production Deployment (Raspberry Pi)

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. Clone repository
git clone <your-repo-url> ~/machine-dashboard
cd ~/machine-dashboard

# 4. Start PostgreSQL container
docker compose up -d postgres

# 5. Install dependencies and build
bun install
bun run build

# 6. Run migrations and seed
bun run db:migrate
bun run db:seed
bun run build

# 6. Start server
bun run packages/api/dist/index.js
```

### Systemd Service

```ini
# /etc/systemd/system/machine-dashboard.service

[Unit]
Description=Machine Status Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/machine-dashboard
ExecStart=/home/pi/.bun/bin/bun run packages/api/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable machine-dashboard
sudo systemctl start machine-dashboard
```

---

## Phase 12: Installation Timeline

### Week 1: Pilot (2-3 machines)
1. Order parts for 3 machines + central system
2. Build and flash one ESP32 on bench with test LEDs
3. Set up Pi with Bun and verify server works
4. Pick 2-3 machines for pilot install
5. Trace stack light wiring, identify common and color wires
6. Install and validate real-time updates

### Week 2-3: Rollout
7. Order remaining parts
8. Build remaining ESP32 units (assembly line style)
9. Install in batches of 4-5 machines
10. Update `MACHINE_ID` and `MACHINE_NAME` for each unit before flashing

---

## Gotchas to Watch For

1. **Stack light polarity** - Check common-positive vs common-negative with a meter
2. **WiFi dead spots** - Walk the floor and verify signal coverage
3. **Power source** - Use USB power adapter if 24V isn't convenient
4. **Unique machine IDs** - Change `MACHINE_ID` when flashing each ESP32
5. **ESP32 input pins** - GPIO 34/35/36/39 lack internal pull-ups; verify optocoupler module has them
6. **PostgreSQL connection pooling** - Use connection pooling for better concurrent access
7. **Bun on ARM** - Bun supports ARM64 (Pi 4), but verify version compatibility

---

## Future Enhancements

- [ ] Historical charts (cycle count over time, uptime %)
- [ ] Email/SMS alerts for fault conditions
- [ ] Multiple dashboard views (by line, by machine type)
- [ ] OEE (Overall Equipment Effectiveness) calculations
- [ ] Authentication for admin features
- [ ] Docker deployment option
- [ ] Mobile-responsive design improvements
