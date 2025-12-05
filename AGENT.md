# Agent Instructions

## Project Overview
**Molding Shop Status** - A real-time monitoring dashboard for injection molding machines in a manufacturing facility. The system tracks machine status (Running/Idle/Fault/Offline), cycle times, production orders, and floor layout positions. Data comes from ESP32 sensors attached to machines or manual operator input.

### Business Context
- **Users**: Line leaders, production planners, and administrators
- **Machines**: 18 injection molding machines (HAITIAN, ZHAFIR, ENGEL brands) ranging from 80T to 650T
- **Purpose**: Real-time visibility into shop floor status, reduce downtime, track production targets

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 (new `@import` syntax) |
| State | TanStack Query (React Query) |
| Backend | Hono (lightweight Node.js framework) |
| Database | PostgreSQL 15 + Drizzle ORM |
| Auth | JWT with Argon2 password hashing |
| Linting | Biome (replaces ESLint + Prettier) |
| Testing | Playwright (E2E), Vitest (unit - planned) |
| Package Manager | Bun |
| Monorepo | Bun workspaces |

## Key Commands
```bash
# Install all dependencies
bun install

# Start both API and Web dev servers
bun run dev

# Start individually
cd packages/api && bun run dev    # API on :3000
cd packages/web && bun run dev    # Web on :5173

# Database
cd packages/api
bun run db:generate   # Generate migrations from schema changes
bun run db:migrate    # Apply migrations
bun run db:seed       # Seed initial data (machines, parts, users)

# Linting & Formatting
bun run lint          # Check all files
bun run lint:fix      # Auto-fix issues

# Testing
cd packages/web && npx playwright test        # Run all E2E tests
cd packages/web && npx playwright test --ui   # Interactive test runner

# Type checking
bun run --filter '*' typecheck
```

## Environment Variables
Create `.env` in project root:
```env
DATABASE_URL=postgresql://molding:molding_secret@localhost:5432/molding_shop
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
ESP32_API_KEY=device-api-key-for-esp32
NODE_ENV=development
API_PORT=3000
VITE_API_URL=http://localhost:3000
```

## Project Structure
```
molding-shop-status/
├── packages/
│   ├── api/                      # Backend API
│   │   └── src/
│   │       ├── index.ts          # Hono app entry
│   │       ├── routes/
│   │       │   ├── auth.ts       # Login, JWT issuance
│   │       │   ├── machines.ts   # Machine CRUD & status
│   │       │   ├── parts.ts      # Parts catalog
│   │       │   ├── orders.ts     # Production orders
│   │       │   └── summary.ts    # Dashboard aggregations
│   │       ├── db/
│   │       │   ├── schema.ts     # Drizzle table definitions
│   │       │   ├── migrations/   # SQL migration files
│   │       │   └── seed.ts       # Initial data seeding
│   │       └── middleware/
│   │           └── auth.ts       # JWT validation, role checks
│   │
│   └── web/                      # Frontend React App
│       └── src/
│           ├── App.tsx           # Main app with routing
│           ├── components/
│           │   ├── Dashboard.tsx         # Main grid/table/floor views
│           │   ├── MachineCard.tsx       # Individual machine display
│           │   ├── MachinesPage.tsx      # Admin CRUD for machines
│           │   ├── FloorLayoutDashboard.tsx  # Spatial view
│           │   ├── EditableTable.tsx     # Inline-editable data table
│           │   ├── OrdersPage.tsx        # Order management
│           │   ├── PartsPage.tsx         # Parts catalog
│           │   └── ui/                   # Shared UI primitives
│           ├── hooks/
│           │   └── useMachines.ts        # React Query hooks
│           └── lib/
│               └── auth.tsx              # Auth context & hooks
│
├── docs/
│   ├── design-system.md          # UI guidelines
│   ├── machine-inventory.md      # Machine specifications
│   └── parts-catalog.md          # Product catalog
│
├── biome.json                    # Linting & formatting config
├── docker-compose.yml            # PostgreSQL container
└── AGENT.md                      # This file
```

## API Routes Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |

### Machines
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/machines` | None | List all machines with status |
| GET | `/api/machines/:id` | None | Get single machine |
| POST | `/api/machines` | Admin | Create machine |
| PUT | `/api/machines/:id` | Admin | Update machine |
| DELETE | `/api/machines/:id` | Admin | Delete machine (cascades) |
| POST | `/api/machines/:id/status` | ESP32 Key | Update status from sensor |
| PUT | `/api/machines/:id/input-mode` | Admin | Toggle auto/manual mode |

### Parts & Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/parts` | None | List all parts |
| POST | `/api/parts` | JWT | Create part |
| GET | `/api/orders` | JWT | List orders |
| POST | `/api/orders` | JWT | Create order |
| POST | `/api/orders/import` | JWT | Bulk import from CSV |

### Summary
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/summary` | None | Dashboard stats (running/idle/fault counts) |

## Frontend Components

### Core Views
- **Dashboard.tsx**: Main view with 3 modes - Grid (cards), Table (data), Floor Layout (spatial)
- **MachineCard.tsx**: Displays machine status, current part, cycle times
- **FloorLayoutDashboard.tsx**: Shows machines in their physical floor positions (top/middle/bottom rows)

### Admin Pages (require admin role)
- **MachinesPage.tsx**: Full CRUD for machines with modal forms
- **PartsPage.tsx**: Manage parts catalog
- **OrdersPage.tsx**: View/import production orders

### Data Flow
1. **Polling**: `useMachines()` hook polls `/api/machines` every 2 seconds
2. **Mutations**: TanStack Query mutations for create/update/delete
3. **Optimistic Updates**: Query invalidation on mutation success

## Database Schema

### Key Tables
```sql
machines (machineId, machineName, brand, model, tonnage, is2K, floorRow, floorPosition, inputMode)
parts (partId, partNumber, description, cycleTime, cavityCount)
machineParts (machineId, partId)  -- M:N relation
statusLogs (logId, machineId, status, timestamp, partId, cycleCount)
users (userId, username, passwordHash, role)
orders (orderId, partId, quantity, dueDate, status)
downtimeReasons (reasonId, code, description)
```

### Machine Status Values
- `running` - Actively producing
- `idle` - Powered on, not producing
- `fault` - Error state, needs attention
- `offline` - Not communicating

## Authentication & Authorization

### Roles
- **admin**: Full access, can manage machines/users
- **planner**: Can manage orders, view all data
- **viewer**: Read-only dashboard access

### JWT Structure
```json
{
  "userId": 1,
  "username": "admin",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### First Login
If a user's `passwordHash` is NULL, any password on first login sets it (bootstrap flow).

## Design System: "Industrial Precision"
See `docs/design-system.md` for full details.

### Key Principles
- **Light Mode**: `bg-slate-50` background, white cards
- **Sharp Edges**: `rounded-sm` or `rounded-none`, no soft curves
- **Status Colors**: Solid blocks - emerald-600 (running), red-600 (fault), amber-500 (idle)
- **Typography**: Inter font, DIN-style uppercase labels, tabular numbers

## Testing

### E2E Tests (Playwright)
Located in `packages/web/e2e/`:
- `dashboard.spec.ts`: Login flow, view toggling, data display

```bash
# Run tests
cd packages/web && npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test dashboard.spec.ts
```

### Test User
- Username: `admin`
- Password: `admin123`

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` (warning), prefer explicit types
- Use Zod for runtime validation

### React
- Functional components only
- Use TanStack Query for server state
- Use `useState` for UI state
- Wrap inputs in `<label>` for accessibility

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils: `camelCase.ts`

### Git Hooks (Lefthook)
- **pre-commit**: Biome lint check
- **pre-push**: Lint + typecheck

## Common Tasks

### Adding a New API Endpoint
1. Create route in `packages/api/src/routes/`
2. Add Zod schema for request validation
3. Register in `packages/api/src/index.ts`

### Adding a New Component
1. Create in `packages/web/src/components/`
2. Follow "Industrial Precision" design system
3. Use TanStack Query hooks for data

### Adding a Database Table
1. Add table definition in `packages/api/src/db/schema.ts`
2. Run `bun run db:generate` to create migration
3. Run `bun run db:migrate` to apply

### Debugging
- API logs to console with request details
- React Query Devtools available in dev mode
- Check Network tab for API responses
