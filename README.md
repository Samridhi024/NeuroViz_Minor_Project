# 🌾 Samruddhi Agros

Hyperlocal farm-to-customer quick-commerce platform. Delivering fresh produce directly from a single farm to customers within a 15km radius.

## Tech Stack

| Layer | Technology |
|---|---|
| Customer App | React Native (Expo) |
| Delivery App | React Native (Expo) |
| Admin Dashboard | Next.js 15 |
| Backend API | Node.js 22 + Express.js |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| ORM | Prisma |
| Monorepo | Turborepo + pnpm |

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker & Docker Compose (for local PostgreSQL + Redis)
- Git

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url>
cd samruddhi-agros
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Start databases
docker compose up -d

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start all apps in development
pnpm dev
```

## Project Structure

```
samruddhi-agros/
├── apps/
│   ├── customer-app/       # React Native (Expo) — Customer
│   ├── delivery-app/       # React Native (Expo) — Delivery Partner
│   └── admin-dashboard/    # Next.js 15 — Admin Web
├── packages/
│   ├── api-client/         # Shared API client (axios + types)
│   ├── shared-types/       # Shared TypeScript types
│   └── ui-components/      # Shared React Native components
├── server/                 # Node.js + Express backend
│   ├── prisma/             # Database schema + migrations
│   └── src/                # Application source code
├── docker-compose.yml      # Local dev databases
└── turbo.json              # Turborepo configuration
```

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm test` | Run all tests |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |

## License

Private — All rights reserved.
