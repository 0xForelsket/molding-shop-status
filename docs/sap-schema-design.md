# Schema Design: SAP-style Molds (PRT)

In SAP, Molds are typically managed as **Production Resources/Tools (PRT)**, often created as **Equipment** records.

## SAP Structure Map
| SAP Concept | Our Schema | Notes |
|-------------|------------|-------|
| **Material** | `items` | The part being produced |
| **Work Center** | `work_centers` | The machine |
| **Equipment (PRT)** | `molds` | The tool/mold. Has status, maintenance info. |
| **Routing** | `routing` | Defines the process. Links Material + Work Center + PRT. |

## Proposed Schema Changes

### 1. New Table: `molds` (Equipment)
Represents the physical asset.
```typescript
export const molds = pgTable('molds', {
  id: text('id').primaryKey(), // Equipment Number (e.g., 'MLD-001')
  name: text('name').notNull(), // Description
  cavities: integer('cavities').default(1),
  runnerType: text('runner_type'), // 'hot', 'cold'
  gateType: text('gate_type'),
  status: text('status').default('active'), // 'active', 'maintenance', 'retired'
  totalShots: integer('total_shots').default(0),
  maintenanceInterval: integer('maintenance_interval'), // shots between maintenance
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 2. Update Table: `routing`
Now represents a valid **Production Version** (Item + Work Center + Mold).
*   **Constraint Change**: Unique key is no longer `(item, work_center)`. It must be `(item, work_center, mold)`.
*   This allows defining:
    *   Item A on Machine 1 using Mold X
    *   Item A on Machine 1 using Mold Y (Alternative)

```typescript
export const routing = pgTable('routing', {
  id: serial('id').primaryKey(),
  itemNumber: text('item_number').references(() => items.itemNumber),
  workCenterId: integer('work_center_id').references(() => workCenters.id),
  moldId: text('mold_id').references(() => molds.id), // Link to PRT

  // Process Parameters
  cycleTime: real('cycle_time'),
  outputQty: integer('output_qty'), // Derived from mold cavities, but can be overridden (e.g. blocked cavities)
  setupTime: integer('setup_time'),
  
  // ...
});
```

### 3. Junction Table: `item_molds` (Optional but helpful)
In SAP, you might link PRTs to Materials directly (Material PRT) or just in Routing.
For this app, `routing` is sufficient to define valid combinations.

## Migration Strategy
1.  Create `molds` table.
2.  Update `routing` to add `mold_id` FK.
3.  Update `routing` unique constraints.
