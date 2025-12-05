# Design System: Industrial Precision

**Theme**: Modern German Industrial Light
**Philosophy**: Functional, Data-Dense, High-Contrast, "No-Nonsense" Engineering.

## Reference Images
See `docs/inspiration-ui-1.png` and `docs/inspiration-ui-2.png` for the target aesthetic.

Key elements from inspiration:
- Left sidebar navigation with icons
- Summary bar with colored stat boxes (Total, Running, Idle, Fault, Offline)
- Dense grid of machine cards showing ID, brand, status, part, cycle time, OEE
- Right-side details panel for selected machine (fault info, signals, logs)
- View toggle buttons (Grid / Floor / Table)

## 1. Core Palette
The UI primarily uses a stark, clean light mode.

### Backgrounds
- **App Background**: `bg-slate-50` (#F8FAFC) - Cool, very light grey.
- **Surface (Cards/Panels)**: `bg-white` (#FFFFFF) - Plain white.
- **Sidebar/Nav**: `bg-white` (#FFFFFF) with `border-b` divider.

### Typography & Borders
- **Primary Text**: `text-slate-900` (#0F172A) - Almost black, high readability.
- **Secondary Text**: `text-slate-500` (#64748B) - For labels (e.g., "Cycle Time").
- **Borders**: `border-slate-200` (#E2E8F0) - Thin, sharp dividers. No soft borders.

### Status Indicators (The "Signal Lights")
Solid, bold colors. No gradients, no soft glows.
- **Running**: `bg-emerald-600` (#059669) - Deep, safety green.
- **Idle**: `bg-amber-500` (#F59E0B) - Warning orange/yellow.
- **Offline**: `bg-slate-300` (#CBD5E1) - Disabled grey.
- **Fault/Stop**: `bg-red-600` (#DC2626) - Signal red.

## 2. Typography
**Font Family**: `Inter` (or system sans-serif), styled to resemble **DIN 1451**.
- **Headings**: Semi-bold, tight tracking (`tracking-tight`).
- **Data**: Tabular nums (`tabular-nums`) for all metrics (Cycle times, Tonnages).
- **Labels**: Small, uppercase, tracking-wide (`text-xs uppercase tracking-wide`).

## 3. Shape & Form
- **Corner Radius**:
  - Cards: `rounded-sm` (2px) or `rounded-none`. Sharp look.
  - Buttons: `rounded-sm` (2px).
  - Inputs: `rounded-none`.
- **Shadows**:
  - Cards: `shadow-sm` (very subtle lift) or just border.
  - Modals: `shadow-lg` (sharp, defined shadow).
- **Spacing**:
  - Dense but structured. `gap-2` or `gap-4`.

## 4. Components

### Machine Card
- **Container**: White, 1px slate-200 border, `shadow-sm`.
- **Header Badge**: Top-left machine ID (e.g., **IM01**) in a dark block or bold text.
- **Status Strip**: A 4px solid color line at the very top of the card.
- **Metrics Grid**: Compact grid of key data.
  - Label: Tiny, slate-500.
  - Value: Large, slate-900, bold.

### Data Tables
- **Header**: White background, bold text, thick black bottom border (`border-b-2 border-black`).
- **Rows**: White background, 1px slate-100 dividers. Hover state: `hover:bg-slate-50`.
- **Cells**: Compact padding (`py-2 px-3`).

### Navigation / Header
- **Style**: White bar, `border-b border-slate-200`.
- **Controls**: Rectangular buttons with icon + label.

## 5. Iconography
- **Set**: Lucide React.
- **Style**: Thin strokes (1.5px), small sizes (`w-4 h-4`).
- **Color**: Slate-500 (inactive), Slate-900 (active/emphasized).
