# Approval Workflow

## Goals

1. No billable work begins without an explicit decision.
2. Every approval is logged with actor, time, and comment.
3. Management can see "what needs my decision" in one place.
4. Client approvals (often async — WhatsApp / email) can be recorded by CS with proof.

---

## State machine

```
                         ┌───────────────────────┐
   ticket created  ───►  │  pending_classification│
                         └─────────┬─────────────┘
                                   │ CS sets classification
                                   ▼
                  ┌───────────────────────────────────┐
                  │      classification chosen        │
                  └────┬──────┬──────┬─────────┬──────┘
                       │      │      │         │
                       │      │      │         │
             included  │      │      │ goodwill│  out_of_scope
                       │      │      │         │
                       ▼      ▼      ▼         ▼
                ┌─────────┐ ┌─────────────────────────────────┐
                │approved │ │     pending_management          │
                │ (auto)  │ │  (notify management role)       │
                └─────────┘ └────────┬─────────────┬──────────┘
                                     │             │
                                  approved      rejected
                                     │             │
                                     │             └─► rejected (final)
                                     ▼
                       ┌─────────────────────────────────┐
                       │   extra_billable only:          │
                       │     pending_client              │
                       │   (CS records client decision)  │
                       └────────┬───────────────┬────────┘
                                │               │
                          approved           rejected
                                │               │
                                ▼               ▼
                          ┌─────────┐     ┌─────────┐
                          │approved │     │rejected │
                          └────┬────┘     └─────────┘
                               │ trigger generates job_code
                               ▼
                       work begins → tasks dispatched
```

`revision` is special: it short-circuits unless the client has exhausted `clients.allowed_revisions`. If exhausted, the engine reclassifies to `extra_billable` and routes it through the approval flow above.

---

## Who approves what

| Classification | Mgmt approval | Client approval | Why |
|----------------|---------------|-----------------|-----|
| Included | — | — | Already in retainer |
| Revision (within budget) | — | — | Already in retainer |
| Revision (over budget) | required | required | Becomes billable |
| Extra Billable | required | required | Bills the client |
| Goodwill | required | — | Free, but management owns the goodwill budget |
| Out of Scope | required | — | First decision is "do we even discuss this?" |

---

## Approval data model

Each transition writes a row to `approvals`. Reading the most recent rows reconstructs the state.

```typescript
// canonical TS view
type ApprovalRow = {
  id: string;
  ticket_id: string;
  stage: 'pending_management' | 'pending_client' | 'approved' | 'rejected';
  decision: 'requested' | 'approved' | 'rejected' | 'withdrawn';
  actor_id: string | null;        // user UUID when internal
  actor_label: string | null;     // 'client:rahul@tata.com' when external
  comment: string | null;
  estimated_amount: number | null;
  created_at: string;
};
```

A ticket's current `approval_stage` is the materialized "head" of this log, kept on the `tickets` row for indexed queries.

---

## Why we record external approvals

In practice, client approvals happen on WhatsApp/email. CS pastes the screenshot/email into an attachment and clicks "Client approved" in the UI. The system records:

- `actor_id = null`
- `actor_label = 'client:<email or phone>'`
- `comment = <CS notes + link to attachment>`

This is the audit trail finance asks for when a client disputes a bill three months later.

---

## UI surfaces

### Approval Inbox (`/approvals`)

A single queue for the logged-in role:

- **Management** sees `pending_management` tickets
- **CS** sees `pending_client` tickets they're assigned to
- Each row shows: client, request title, estimated amount, requester, age
- Bulk approve / reject is allowed for management on low-value items (configurable threshold)

### Ticket detail page

Shows the full `approvals` history as a vertical timeline. New comments append; nothing rewrites history.

### Notifications

Triggered on:
- New `pending_management` ticket → all management users
- `pending_client` → assigned CS
- Approval / rejection → requester + AM

---

## Edge cases handled

| Case | Behavior |
|------|----------|
| Client rejects after management approved | Status `rejected`, billable not created, audit preserved |
| Management approves, then withdraws | Allowed within 24h via "withdraw" action; logs `decision='withdrawn'`; ticket returns to `pending_management` |
| Classification changed after approval | Triggers re-approval (audit row notes the change) |
| CS changes classification while management is reviewing | Blocked at DB level; CS gets a clear error |
| Out-of-scope escalated then declined | Status `rejected`, no billable, client gets a "we can scope this separately" follow-up task |
