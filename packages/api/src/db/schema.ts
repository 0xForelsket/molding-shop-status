// packages/api/src/db/schema.ts

import { boolean, integer, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

// ============== WORK CENTERS (formerly machines) ==============

export const workCenters = pgTable('work_centers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').default('injection').notNull(), // 'injection', 'assembly', 'other'
  status: text('status').default('offline').notNull(), // 'running', 'idle', 'fault', 'offline'
  green: boolean('green').default(false),
  red: boolean('red').default(false),
  cycleCount: integer('cycle_count').default(0),

  // Input Mode: 'auto' (ESP32 signal) or 'manual' (line leader input)
  inputMode: text('input_mode').default('auto').notNull(),
  statusUpdatedBy: text('status_updated_by'),

  // Work Center Specifications (static)
  brand: text('brand'),
  model: text('model'),
  serialNo: text('serial_no'),
  tonnage: integer('tonnage'),
  screwDiameter: real('screw_diameter'),
  injectionWeight: real('injection_weight'),
  is2K: boolean('is_2k').default(false),

  // Floor Layout Position
  floorRow: text('floor_row'), // 'top', 'middle', 'bottom'
  floorPosition: integer('floor_position'), // order within row (1=left)

  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Legacy alias for backwards compatibility during migration
export const machines = workCenters;

// ============== STATUS LOGS ==============

export const statusLogs = pgTable('status_logs', {
  id: serial('id').primaryKey(),
  workCenterId: integer('work_center_id')
    .references(() => workCenters.id)
    .notNull(),
  status: text('status').notNull(),
  cycleCount: integer('cycle_count'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// ============== PRODUCTION SUPERVISORS ==============

export const productionSupervisors = pgTable('production_supervisors', {
  code: text('code').primaryKey(), // P01, P02, P03
  name: text('name').notNull(), // Molding, Preassembly, Final Packaging
  description: text('description'),
  isActive: boolean('is_active').default(true),
});

// ============== MOLDS (Equipment / PRT) ==============

export const molds = pgTable('molds', {
  id: text('id').primaryKey(), // Equipment Number (e.g. MLD-001)
  name: text('name').notNull(),
  cavities: integer('cavities').default(1).notNull(),
  runnerType: text('runner_type'), // 'hot', 'cold'
  gateType: text('gate_type'),
  status: text('status').default('active'), // 'active', 'maintenance', 'retired'
  totalShots: integer('total_shots').default(0),
  maintenanceInterval: integer('maintenance_interval'), // shots between maintenance
  createdAt: timestamp('created_at').defaultNow(),
});

// ============== ITEMS (formerly parts) ==============

export const items = pgTable('items', {
  itemNumber: text('item_number').primaryKey(),
  name: text('name').notNull(),
  materialType: text('material_type').notNull().default('HALB'), // 'ROH', 'HALB', 'FERT'
  uom: text('uom').default('PCS'), // Unit of measure: PCS, KG, G
  productLine: text('product_line'),
  supervisorCode: text('supervisor_code').references(() => productionSupervisors.code), // P01, P02, P03
  imageUrl: text('image_url'),

  // Physical properties (for HALB/FERT)
  partWeight: real('part_weight'), // grams
  runnerWeight: real('runner_weight'), // grams

  // Material properties (for ROH)
  supplier: text('supplier'),
  density: real('density'),
  meltTemp: real('melt_temp'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Legacy alias for backwards compatibility
export const parts = items;

// ============== BOM (Bill of Materials) ==============

export const bom = pgTable('bom', {
  id: serial('id').primaryKey(),
  parentItem: text('parent_item')
    .references(() => items.itemNumber)
    .notNull(),
  childItem: text('child_item')
    .references(() => items.itemNumber)
    .notNull(),
  quantity: real('quantity').notNull(),
  uom: text('uom'), // matches child's UOM
  notes: text('notes'),
});

// ============== ROUTING (formerly machine_parts) ==============

export const routing = pgTable('routing', {
  id: serial('id').primaryKey(),
  workCenterId: integer('work_center_id')
    .references(() => workCenters.id)
    .notNull(),
  itemNumber: text('item_number')
    .references(() => items.itemNumber)
    .notNull(),
  moldId: text('mold_id').references(() => molds.id), // Link to PRT (Mold)
  cycleTime: real('cycle_time'), // seconds
  outputQty: integer('output_qty').default(1), // parts per cycle (defaults to mold cavities, can be overridden)
  setupTime: integer('setup_time'), // minutes
  notes: text('notes'),
});

// Legacy alias for backwards compatibility
export const machineParts = routing;

// ============== PRODUCTION ORDERS ==============

export const productionOrders = pgTable('production_orders', {
  orderNumber: text('order_number').primaryKey(),
  itemNumber: text('item_number')
    .references(() => items.itemNumber)
    .notNull(),
  quantityRequired: integer('quantity_required').notNull(),
  quantityCompleted: integer('quantity_completed').default(0),
  workCenterId: integer('work_center_id').references(() => workCenters.id),
  status: text('status').default('pending'), // 'pending', 'assigned', 'running', 'completed', 'cancelled'

  // Planning Fields
  targetCycleTime: real('target_cycle_time'), // Override routing default
  targetUtilization: integer('target_utilization'), // e.g. 90%
  dueDate: timestamp('due_date'),
  notes: text('notes'),
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

// ============== SHIFT BREAKS (Template defaults) ==============

export const shiftBreaks = pgTable('shift_breaks', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isActive: boolean('is_active').default(true),
});

// ============== PLANT CALENDAR ==============

export const plantCalendar = pgTable('plant_calendar', {
  date: text('date').primaryKey(), // YYYY-MM-DD format
  dayType: text('day_type').notNull().default('working'),
  weekNum: integer('week_num'),
  name: text('name'),
  notes: text('notes'),
});

// ============== SHIFT INSTANCES ==============

export const shiftInstances = pgTable('shift_instances', {
  id: serial('id').primaryKey(),
  shiftTemplateId: integer('shift_template_id')
    .notNull()
    .references(() => shifts.id),
  productionDate: text('production_date')
    .notNull()
    .references(() => plantCalendar.date),
  plannedStartAt: timestamp('planned_start_at').notNull(),
  plannedEndAt: timestamp('planned_end_at').notNull(),
  actualStartAt: timestamp('actual_start_at'),
  actualEndAt: timestamp('actual_end_at'),
  status: text('status').default('scheduled'),
  isOvertime: boolean('is_overtime').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============== SHIFT INSTANCE BREAKS ==============

export const shiftInstanceBreaks = pgTable('shift_instance_breaks', {
  id: serial('id').primaryKey(),
  shiftInstanceId: integer('shift_instance_id')
    .notNull()
    .references(() => shiftInstances.id),
  name: text('name').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
});

// ============== DOWNTIME REASONS ==============

export const downtimeReasons = pgTable('downtime_reasons', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  isActive: boolean('is_active').default(true),
});

// ============== DOWNTIME LOGS ==============

export const downtimeLogs = pgTable('downtime_logs', {
  id: serial('id').primaryKey(),
  workCenterId: integer('work_center_id')
    .references(() => workCenters.id)
    .notNull(),
  reasonCode: text('reason_code')
    .references(() => downtimeReasons.code)
    .notNull(),
  shiftInstanceId: integer('shift_instance_id').references(() => shiftInstances.id),
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
  role: text('role').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// ============== TYPE EXPORTS ==============

export type WorkCenter = typeof workCenters.$inferSelect;
export type NewWorkCenter = typeof workCenters.$inferInsert;
export type Machine = WorkCenter; // Legacy alias
export type NewMachine = NewWorkCenter; // Legacy alias

export type StatusLog = typeof statusLogs.$inferSelect;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Part = Item; // Legacy alias

export type Bom = typeof bom.$inferSelect;
export type NewBom = typeof bom.$inferInsert;

export type Routing = typeof routing.$inferSelect;
export type NewRouting = typeof routing.$inferInsert;
export type MachinePart = Routing; // Legacy alias

export type Mold = typeof molds.$inferSelect;
export type NewMold = typeof molds.$inferInsert;

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftBreak = typeof shiftBreaks.$inferSelect;
export type PlantCalendar = typeof plantCalendar.$inferSelect;
export type ShiftInstance = typeof shiftInstances.$inferSelect;
export type ShiftInstanceBreak = typeof shiftInstanceBreaks.$inferSelect;
export type DowntimeReason = typeof downtimeReasons.$inferSelect;
export type DowntimeLog = typeof downtimeLogs.$inferSelect;
export type ProductLine = typeof productLines.$inferSelect;
export type User = typeof users.$inferSelect;

// ============== PRODUCTION LOGS ==============

export const productionLogs = pgTable('production_logs', {
  id: serial('id').primaryKey(),
  workCenterId: integer('work_center_id')
    .references(() => workCenters.id)
    .notNull(),
  orderNumber: text('order_number')
    .references(() => productionOrders.orderNumber)
    .notNull(),
  shiftInstanceId: integer('shift_instance_id')
    .references(() => shiftInstances.id)
    .notNull(),

  quantityProduced: integer('quantity_produced').default(0),
  quantityScrap: integer('quantity_scrap').default(0),

  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),

  status: text('status').default('in_progress'),

  loggedBy: text('logged_by'),
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
});

export type ProductionLog = typeof productionLogs.$inferSelect;
export type NewProductionLog = typeof productionLogs.$inferInsert;

// ============== SCRAP REASONS ==============

export const scrapReasons = pgTable('scrap_reasons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull().default('general'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const productionLogScraps = pgTable('production_log_scraps', {
  id: serial('id').primaryKey(),
  productionLogId: integer('production_log_id')
    .notNull()
    .references(() => productionLogs.id),
  scrapReasonId: integer('scrap_reason_id')
    .notNull()
    .references(() => scrapReasons.id),
  quantity: integer('quantity').notNull().default(0),
});

export type ScrapReason = typeof scrapReasons.$inferSelect;
export type ProductionLogScrap = typeof productionLogScraps.$inferSelect;
