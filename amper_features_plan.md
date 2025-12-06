# Amper-Inspired Feature Implementation Plan

This plan outlines the roadmap to transform the `molding-shop-status` app into a full-featured manufacturing execution system (MES) inspired by Amper.co.

## 1. Timeline View (Machine History)
**Goal**: Visualize machine status over time (e.g., last 12 hours) to identify patterns and downtime.

### Backend
-   **API**: `GET /api/machines/:id/timeline?start=...&end=...`
    -   Query `status_logs` table.
    -   Return segments: `{ status: 'running', start: '10:00', end: '10:45', duration: 45m }`.
    -   Logic to merge contiguous logs of the same status.

### Frontend
-   **Component**: `TimelineBar`
    -   Horizontal bar chart.
    -   Color-coded segments (Green=Running, Red=Fault, Yellow=Idle, Grey=Offline).
    -   Tooltip showing start/end time and duration on hover.
-   **Integration**: Add to `MachineCard` (mini view) and a new `MachineDetails` page (full view).

## 2. Operator Copilot (Help Requests / Andon)
**Goal**: Allow operators to request support (Maintenance, Quality, Supervisor) directly from the machine interface.

### Database
-   **New Table**: `alerts`
    -   `id`, `machine_id`, `type` (maintenance, quality, material, help), `status` (open, acknowledged, resolved), `created_at`, `resolved_at`, `created_by`, `resolved_by`.

### Backend
-   **API**:
    -   `POST /api/alerts`: Create a new alert.
    -   `PATCH /api/alerts/:id`: Acknowledge or resolve an alert.
    -   `GET /api/alerts/active`: Get all open alerts for the dashboard.

### Frontend
-   **UI**:
    -   "Call for Help" button on `MachineCard` (Manual Mode).
    -   Modal to select help type (e.g., "Material Shortage", "Machine Jam").
    -   **Andon Board**: A new dashboard view showing only active alerts for support staff.

## 3. Downtime Analysis (Pareto Charts)
**Goal**: Visualize top downtime reasons to prioritize improvements.

### Backend
-   **API**: `GET /api/analytics/downtime?range=week`
    -   Aggregate `downtime_logs` by `reasonCode`.
    -   Calculate total duration and frequency per reason.
    -   Sort by total duration (descending).

### Frontend
-   **Library**: Install `recharts` for charting.
-   **Component**: `DowntimeParetoChart`
    -   Bar chart showing hours down per reason.
    -   Line chart overlay for cumulative percentage.

## 4. Changeover Scoreboard (Job Scheduling)
**Goal**: Manage the queue of upcoming jobs and track changeover progress.

### Database
-   **Update**: `production_orders`
    -   Add `priority` (int) or `scheduled_start_date` (timestamp).
    -   Add `setup_status` (not_started, in_progress, completed).

### Backend
-   **API**:
    -   `GET /api/machines/:id/schedule`: Get upcoming orders.
    -   `PATCH /api/orders/:id/reorder`: Update priority (drag-and-drop support).

### Frontend
-   **UI**:
    -   **Scheduler View**: Drag-and-drop interface (using `@dnd-kit/core`) to assign orders to machines and reorder them.
    -   **Changeover Card**: Special view for machines in `setup` state, showing checklists and timers.

## 5. Shop Floor OEE (Aggregate Metrics)
**Goal**: High-level view of factory performance.

### Backend
-   **Update**: `/api/summary`
    -   Calculate aggregate OEE (Average Availability x Average Performance x Average Quality).
    -   Add `total_parts_produced` vs `total_target`.

### Frontend
-   **Component**: `ShopFloorStats`
    -   Big number cards at the top of the dashboard.
    -   "Shift Progress" bar.

## Implementation Phases

### Phase 1: Timeline & Visuals (Current Focus)
-   [ ] Implement `TimelineBar` component.
-   [ ] Integrate into `MachineCard`.

### Phase 2: Operator Tools
-   [ ] Create `alerts` table.
-   [ ] Build "Call for Help" UI.

### Phase 3: Analytics & Scheduling
-   [ ] Install `recharts`.
-   [ ] Build Downtime Pareto.
-   [ ] Build Scheduler interface.
