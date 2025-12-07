# Schema Design Discussion

## Current Progress - Migration Selections

**Tables:**
| Prompt | Selection | Reason |
|--------|-----------|--------|
| bom | `+ bom` (create) | NEW table |
| items | `~ parts › items` (rename) | Renamed from parts |
| routing | `~ machine_parts › routing` (rename) | Renamed from machine_parts |
| work_centers | `~ machines › work_centers` (rename) | Renamed from machines |
| production_supervisors | `+ production_supervisors` (create) | NEW table |

**Columns:**
| Table | Column | Selection | Reason |
|-------|--------|-----------|--------|
| downtime_logs | work_center_id | `~ machine_id › work_center_id` | Renamed |
| routing | cycle_time | `~ target_cycle_time › cycle_time` | Renamed |
| routing | output_qty | `~ cavity_plan › output_qty` | Renamed |
| routing | mold_id | `+ mold_id` (create) | **⚠️ PAUSED - see below** |
| routing | setup_time | `+ setup_time` (create) | NEW |
| routing | runner_type | `+ runner_type` (create) | **⚠️ PAUSED - see below** |
| routing | gate_type | `+ gate_type` (create) | **⚠️ PAUSED - see below** |
| routing | notes | `+ notes` (create) | NEW |
| work_centers | id | `~ machine_id › id` | Renamed |

---

## Question: Where should mold/tooling properties go?

### Option A: Keep in Routing (Current Schema)
```
routing (work_center + item specific)
├── mold_id       -- Which mold is used for this item on this work center
├── runner_type   -- Hot/cold runner for this setup
└── gate_type     -- Gate type for this setup
```
**Pro:** Same item might use different molds on different work centers
**Con:** Mold properties don't change per work center

### Option B: Move to Items (Material Master)
```
items (material master)
├── mold_id       -- The mold that produces this item
├── runner_type   -- Runner type of the mold
└── gate_type     -- Gate type of the mold
```
**Pro:** Mold is a property of the item itself
**Con:** If item can run on multiple molds, need a separate molds table

### Option C: Create a Molds Table
```
molds (new lookup table)
├── mold_id (PK)
├── name
├── runner_type
├── gate_type
├── cavities
└── item_number (FK) -- which item this mold produces

routing
└── mold_id (FK) -- which mold is used for this work center + item combo
```
**Pro:** Proper separation of concerns, mold as a reusable asset
**Con:** More complexity

---

## Pending - Not Yet Executed
- work_centers remaining columns (name, type, etc.)
- items columns (materialType, supervisorCode, etc.)
- production_orders columns (item_number, work_center_id)
- status_logs columns

## Next Steps
1. Decide on mold/tooling schema design
2. Update schema.ts if needed
3. Re-run migration with correct selections
