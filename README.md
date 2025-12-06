# Molding Shop Status Dashboard

A real-time monitoring dashboard for injection molding machines in a manufacturing facility. Track machine status, cycle times, production orders, and floor layout positions with data from ESP32 sensors or manual operator input.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Bun](https://img.shields.io/badge/Bun-1.x-orange)

## ✨ Features

- **Real-time Status Monitoring** — See which machines are Running, Idle, Fault, or Offline at a glance
- **Multiple Dashboard Views** — Grid cards, data table, or spatial floor layout view
- **ESP32 IoT Integration** — Automatic data collection from stack light sensors
- **Production Order Tracking** — Manage orders with CSV bulk import support
- **Parts Catalog** — Track parts with cycle times and cavity counts
- **Role-based Access Control** — Admin, Planner, and Viewer roles with JWT authentication
- **Industrial Design** — Clean, high-contrast UI optimized for shop floor visibility

## 🏭 Business Context

- **Users**: Line leaders, production planners, and administrators
- **Machines**: 18 injection molding machines (HAITIAN, ZHAFIR, ENGEL brands) ranging from 80T to 650T
- **Purpose**: Real-time visibility into shop floor status, reduce downtime, track production targets

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + Vite + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **State** | TanStack Query (React Query) |
| **Backend** | Hono (lightweight Node.js framework) |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Auth** | JWT with Argon2 password hashing |
| **Linting** | Biome |
| **Testing** | Playwright (E2E) |
| **Package Manager** | Bun |
| **Monorepo** | Bun workspaces |

## 📁 Project Structure

```
molding-shop-status/
├── packages/
│   ├── api/                  # Backend API (Hono + Drizzle)
│   │   └── src/
│   │       ├── routes/       # API endpoints
│   │       ├── db/           # Schema, migrations, seed
│   │       └── middleware/   # Auth middleware
│   │
│   └── web/                  # Frontend (React + Vite)
│       └── src/
│           ├── components/   # UI components
│           ├── hooks/        # React Query hooks
│           └── lib/          # Utilities & auth context
│
├── firmware/                 # ESP32 Arduino code
│   └── machine_monitor/      # Stack light sensor firmware
│
├── docs/                     # Documentation
│   ├── design-system.md      # UI guidelines
│   ├── machine-inventory.md  # Machine specifications
│   └── parts-catalog.md      # Product catalog
│
└── docker-compose.yml        # PostgreSQL container
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/molding-shop-status.git
cd molding-shop-status
bun install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your settings (see Configuration section)
```

### 3. Start Database

```bash
docker compose up -d
```

### 4. Initialize Database

```bash
bun run db:migrate    # Apply migrations
bun run db:seed       # Seed initial data
```

### 5. Run Development Servers

```bash
bun run dev           # Starts both API (:3000) and Web (:5173)
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Default Login

- **Username**: `admin`
- **Password**: `admin123`

> ⚠️ **Important**: Change the default password in production!

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://molding:molding_secret@localhost:5432/molding_shop

# API Server
API_PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000

# Authentication
ESP32_API_KEY=your-secure-esp32-api-key-change-in-prod
JWT_SECRET=your-secure-jwt-secret-at-least-32-chars
JWT_EXPIRES_IN=24h

# Environment
NODE_ENV=development
```

## 📜 Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `bun run dev` | Start both API and Web dev servers |
| `bun run dev:api` | Start only the API server |
| `bun run dev:web` | Start only the Web dev server |
| `bun run build` | Build both packages for production |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Auto-fix linting issues |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | Run API unit tests |
| `bun run test:e2e` | Run Playwright E2E tests |

### Database

| Command | Description |
|---------|-------------|
| `bun run db:generate` | Generate migrations from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:seed` | Seed database with initial data |

## 🔌 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |

### Machines

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/machines` | None | List all machines |
| GET | `/api/machines/:id` | None | Get single machine |
| POST | `/api/machines` | Admin | Create machine |
| PUT | `/api/machines/:id` | Admin | Update machine |
| DELETE | `/api/machines/:id` | Admin | Delete machine |
| POST | `/api/machines/:id/status` | ESP32 Key | Update status from sensor |

### Parts & Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/parts` | None | List all parts |
| POST | `/api/parts` | JWT | Create part |
| GET | `/api/orders` | JWT | List orders |
| POST | `/api/orders` | JWT | Create order |
| POST | `/api/orders/import` | JWT | Bulk import from CSV |

### Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/summary` | None | Dashboard stats |

## 🔧 ESP32 Firmware

The `firmware/machine_monitor/` directory contains Arduino code for ESP32 devices that read stack light signals and report machine status to the dashboard.

### Hardware Setup

- **ESP32** development board
- **Optocouplers** connected to stack light signals
- GPIO34 → Green light (Running)
- GPIO35 → Red light (Fault)

### Configuration

Edit `machine_monitor.ino`:

```cpp
const int MACHINE_ID = 1;                    // Unique ID (1-18)
const char* MACHINE_NAME = "IM01";           // Display name
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "http://192.168.1.100:3000/api/status";
const char* API_KEY = "your-secure-esp32-api-key";
```

### Status Logic

| Green | Red | Status |
|-------|-----|--------|
| ON | OFF | Running |
| OFF | ON | Fault |
| OFF | OFF | Idle |

## 🧪 Testing

### E2E Tests (Playwright)

```bash
cd packages/web
npx playwright test              # Run all tests
npx playwright test --ui         # Interactive test runner
npx playwright test --headed     # Watch tests in browser
```

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, manage machines/users |
| **Planner** | Manage orders, view all data |
| **Viewer** | Read-only dashboard access |

## 🔒 Security

- Passwords hashed with Argon2
- JWT tokens with configurable expiration
- ESP32 devices authenticate via API key
- Role-based route protection

## 📖 Documentation

- [Design System](docs/design-system.md) — UI guidelines and component patterns
- [Machine Inventory](docs/machine-inventory.md) — Machine specifications
- [Parts Catalog](docs/parts-catalog.md) — Product details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- TypeScript strict mode
- Biome for linting and formatting
- Functional React components
- TanStack Query for server state

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for manufacturing excellence
