# API Reference

We avoid the "REST API for its own sake" trap. The two surfaces are:

1. **Server Actions** (Next.js) — used by the app UI. Type-safe, RHF integrated.
2. **Route Handlers** under `/api/*` — used by external systems (n8n, webhooks, exports).

Reads inside the app go directly through Supabase RSC clients with RLS enforcing access. There is no thin proxy.

---

## Server Actions (typed)

Located in `src/features/<feature>/actions.ts`. All exported with `'use server'`.

### Tickets

```ts
createTicket(input: CreateTicketInput): Promise<{ id: string; ticket_number: number }>;
updateTicket(id: string, patch: UpdateTicketInput): Promise<void>;
classifyTicket(id: string, classification: Classification, comment?: string): Promise<void>;
recordClientApproval(id: string, decision: 'approved'|'rejected', actorLabel: string, comment?: string): Promise<void>;
managementApprove(id: string, decision: 'approved'|'rejected', comment?: string): Promise<void>;
addTicketComment(id: string, body: string): Promise<void>;
softDeleteTicket(id: string): Promise<void>;
```

### Clients

```ts
createClient(input: ClientInput): Promise<{ id: string; client_code: string }>;
updateClient(id: string, patch: Partial<ClientInput>): Promise<void>;
assignClientUser(clientId: string, userId: string): Promise<void>;
unassignClientUser(clientId: string, userId: string): Promise<void>;
```

### Tasks

```ts
createTask(ticketId: string, input: TaskInput): Promise<string>;
updateTaskStatus(taskId: string, status: TaskStatus, completionPct?: number): Promise<void>;
logTime(taskId: string, hours: number, workDate: string, note?: string): Promise<void>;
```

### Billing

```ts
markBillableAsBilled(billableId: string, invoiceRef: string): Promise<void>;
writeOffBillable(billableId: string, reason: string): Promise<void>;
exportBillingPeriod(period: string, format: 'csv'|'json'): Promise<{ url: string }>;
```

### Change requests

```ts
createChangeRequest(input: ChangeRequestInput): Promise<string>;
decideChangeRequest(id: string, decision: 'approved'|'rejected', comment?: string): Promise<void>;
```

All inputs are Zod-validated. All actions write to `audit_log` via the Postgres trigger — actions themselves are thin.

---

## Route Handlers (`/api/*`)

### `POST /api/webhooks/intake`
External request intake (Typeform / Notion / forms.app). Creates a ticket as `pending_classification`.

Auth: `Authorization: Bearer <INTAKE_WEBHOOK_TOKEN>`

Body:
```json
{
  "client_code": "TATA",
  "title": "3 reels for Q2 push",
  "description": "...",
  "request_type": "reel",
  "priority": "high",
  "deadline": "2026-05-30",
  "requested_by_email": "rahul@tata.com",
  "metadata": { "source": "typeform", "form_id": "abc" }
}
```

Response: `{ "id": "...", "ticket_number": 1043, "url": "https://ops.../tickets/1043" }`

### `POST /api/webhooks/approval-callback`
Used by n8n WhatsApp/Email approval flows.

```json
{
  "ticket_id": "...",
  "decision": "approved",
  "actor_label": "client:rahul@tata.com",
  "comment": "Approved on WhatsApp, screenshot attached",
  "attachment_url": "https://..."
}
```

### `GET /api/exports/billing?period=2026-05&format=csv`
Streams a CSV of billable records for the period. Restricted to `accounts` / `management` / `super_admin`.

### `GET /api/exports/profitability?period=2026-05`
Streams a per-client profitability JSON snapshot.

### `POST /api/notifications/test`
Sends a test notification to the current user (dev tool, hidden in prod).

### `GET /api/health`
`{ ok: true, db: 'reachable', auth: 'reachable' }` — used by Vercel uptime monitors.

---

## Standard response envelope (route handlers)

```ts
type ApiOk<T>  = { ok: true;  data: T };
type ApiErr    = { ok: false; error: { code: string; message: string; details?: unknown } };
type ApiResp<T> = ApiOk<T> | ApiErr;
```

Error codes: `unauthorized`, `forbidden`, `not_found`, `validation`, `conflict`, `rate_limited`, `internal`.

---

## Rate limiting

`POST /api/webhooks/*` are limited at the edge (Vercel) using Upstash Redis with a per-token bucket. 60 req/min default.
