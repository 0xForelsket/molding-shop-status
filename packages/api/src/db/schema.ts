// packages/api/src/db/schema.ts

import { boolean, integer, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

// ============== MACHINES ==============

export const machines = pgTable('machines', {
  machineId: serial('machine_id').primaryKey(),
  machineName: text('machine_name').notNull(),
  status: text('status').default('offline').notNull(), // 'running', 'idle', 'fault', 'offline'
  green: boolean('green').default(false),
  red: boolean('red').default(false),
  cycleCount: integer('cycle_count').default(0),

  // Input Mode: 'auto' (ESP32 signal) or 'manual' (line leader input)
  inputMode: text('input_mode').default('auto').notNull(),
  statusUpdatedBy: text('status_updated_by'),

  // Production Order Details (editable per shift)
  productionOrder: text('production_order'),
  partNumber: text('part_number'),
  partName: text('part_name'),
  targetCycleTime: real('target_cycle_time'),
  partsPerCycle: integer('parts_per_cycle').default(1),

  // Machine Specifications (static)
  brand: text('brand'),
  model: text('model'),
  serialNo: text('serial_no'),
  tonnage: integer('tonnage'),
  screwDiameter: real('screw_diameter'),
  injectionWeight: real('injection_weight'),
  is2K: boolean('is_2k').default(false),

  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============== STATUS LOGS ==============

export const statusLogs = pgTable('status_logs', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  status: text('status').notNull(),
  cycleCount: integer('cycle_count'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// ============== PARTS ==============

export const parts = pgTable('parts', {
  partNumber: text('part_number').primaryKey(),
  partName: text('part_name').notNull(),
  productLine: text('product_line'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============== MACHINE-PART CAPABILITIES ==============

export const machineParts = pgTable('machine_parts', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  partNumber: text('part_number')
    .references(() => parts.partNumber)
    .notNull(),
  cavityPlan: integer('cavity_plan').default(1),
  targetCycleTime: real('target_cycle_time'),
});

// ============== PRODUCTION ORDERS ==============

export const productionOrders = pgTable('production_orders', {
  orderNumber: text('order_number').primaryKey(),
  partNumber: text('part_number')
    .references(() => parts.partNumber)
    .notNull(),
  quantityRequired: integer('quantity_required').notNull(),
  quantityCompleted: integer('quantity_completed').default(0),
  machineId: integer('machine_id').references(() => machines.machineId),
  status: text('status').default('pending'), // 'pending', 'assigned', 'running', 'completed', 'cancelled'
  dueDate: timestamp('due_date'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============== SHIFTS ==============

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isActive: boolean('is_active').default(true),
});

// ============== DOWNTIME REASONS ==============

export const downtimeReasons = pgTable('downtime_reasons', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'planned' or 'unplanned'
  isActive: boolean('is_active').default(true),
});

// ============== DOWNTIME LOGS ==============

export const downtimeLogs = pgTable('downtime_logs', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id')
    .references(() => machines.machineId)
    .notNull(),
  reasonCode: text('reason_code')
    .references(() => downtimeReasons.code)
    .notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  durationMinutes: integer('duration_minutes'),
});

// ============== PRODUCT LINES ==============

export const productLines = pgTable('product_lines', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
});

// ============== USERS ==============

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'admin', 'planner', 'line_leader', 'viewer'
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// ============== TYPE EXPORTS ==============

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
