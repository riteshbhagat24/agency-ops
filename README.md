# Agency Ops — Billable Task & Commercial Operations System

An internal SaaS platform for digital marketing agencies (Futuready Media, Orange Videos) to prevent revenue leakage, track billable work, enforce approval workflows, and surface profitability in real time.

**This is NOT a task manager.** It is a commercial operations system where every task carries a commercial classification and every "quick edit" is traceable to a revenue line.

---

## Why this exists

Agencies bleed money in five predictable ways:

1. "Quick edits" turn into free work
2. WhatsApp approvals get lost
3. Extra reels / posts / videos never get billed
4. Strategy calls quietly become execution work
5. Revisions exceed the agreed scope and nobody notices until margins collapse

This system makes all of that visible and approval-gated.

---

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | Server components, streaming, edge ready |
| Language | TypeScript (strict) | Type safety across full stack |
| Styling | TailwindCSS + ShadCN UI | Design-system primitives, no lock-in |
| Animation | Framer Motion | Productivity-grade micro-interactions |
| Database | Supabase (Postgres) | Realtime, RLS, auth in one |
| Auth | Supabase Auth + Google OAuth | Domain-restricted SSO |
| State | Zustand | Lightweight client state |
| Forms | React Hook Form + Zod | Schema-first validation |
| Tables | TanStack Table v8 | Headless, sortable, virtualized |
| Charts | Recharts | Declarative dashboards |
| Automation | n8n-compatible webhooks | External workflows |
| Deploy | Vercel + Supabase Cloud | Zero-ops SaaS deployment |

---

## Phase plan

- **Phase 1 — Foundation** (this delivery): architecture, schema, scaffolding, design tokens, auth, RBAC, demo seed
- **Phase 2 — Core modules**: Clients, Tickets, Classification, Approvals, Tasks
- **Phase 3 — Commercial layer**: Job codes, Billing engine, Change requests, Revisions
- **Phase 4 — Analytics**: Leadership dashboard, profitability views, exports
- **Phase 5 — Ops polish**: Notifications, command palette, mobile, deploy hardening

See [`docs/`](./docs/) for full architecture, schema, wireframes, and runbooks.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Set up Supabase (see docs/setup/supabase.md)
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Run migrations + seed
pnpm db:migrate
pnpm db:seed

# 4. Dev
pnpm dev
```

App boots on `http://localhost:3000`. Sign in with a `@futuready.com` or `@orangevideos.com` Google account (configurable).

---

## Repo layout

```
billable_task_system/
├── docs/                          # architecture, schema, wireframes, runbooks
├── supabase/
│   ├── migrations/                # SQL migrations (versioned)
│   ├── seed.sql                   # demo data
│   └── functions/                 # edge functions (job code generator, notifications)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # login, callback
│   │   ├── (dashboard)/           # authenticated app shell
│   │   │   ├── dashboard/
│   │   │   ├── tickets/
│   │   │   ├── clients/
│   │   │   ├── tasks/
│   │   │   ├── approvals/
│   │   │   ├── billing/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── api/                   # route handlers (webhooks, exports)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn primitives
│   │   ├── shell/                 # sidebar, topbar, command palette
│   │   ├── data/                  # TanStack tables, KPI cards
│   │   ├── forms/                 # RHF + Zod forms
│   │   └── charts/                # Recharts wrappers
│   ├── features/                  # vertical feature slices
│   │   ├── tickets/
│   │   ├── clients/
│   │   ├── classification/
│   │   ├── approvals/
│   │   ├── tasks/
│   │   ├── billing/
│   │   └── analytics/
│   ├── lib/
│   │   ├── supabase/              # server + browser clients
│   │   ├── auth/                  # session, RBAC guard
│   │   ├── jobcode/               # commercial code generator
│   │   ├── utils/
│   │   └── validations/           # zod schemas
│   ├── hooks/
│   ├── stores/                    # zustand stores
│   ├── types/                     # shared types + DB types
│   └── styles/
├── public/
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## Documentation index

- [Architecture overview](./docs/01-architecture.md)
- [Database schema](./docs/02-database-schema.md)
- [Job code engine](./docs/03-job-code-engine.md)
- [Approval workflow](./docs/04-approval-workflow.md)
- [RBAC & permissions](./docs/05-rbac.md)
- [Wireframes](./docs/06-wireframes.md)
- [API reference](./docs/07-api.md)
- [User flows](./docs/08-user-flows.md)
- [Supabase setup](./docs/setup/supabase.md)
- [Vercel deployment](./docs/setup/deployment.md)
