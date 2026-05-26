# User Flows

Each flow is mapped to (1) the user role driving it, (2) the screens they touch, (3) the DB-level effect.

---

## Flow 1 — Inbound request → classification → execution

**Actor:** Client Servicing → Management → Operations
**Goal:** Take a raw request and route it through the commercial gate.

```
1. CS opens /tickets/new
2. CS fills intake form, selects classification = "Extra Billable"
3. Server action createTicket()
       └─► tickets row, status='pending_classification'
4. Server action classifyTicket()
       └─► trigger tickets_classification_router fires
            • approval_stage = 'pending_management'
            • approvals row { stage:'pending_management', decision:'requested' }
            • notifications fan out to all management users
5. Management opens /approvals
6. Management clicks Approve
       └─► server action managementApprove()
            • approvals row { stage:'pending_management', decision:'approved' }
            • approval_stage advances to 'pending_client'
            • CS gets notification "record client decision"
7. CS records client approval (with WhatsApp screenshot attached)
       └─► server action recordClientApproval()
            • approvals row { stage:'pending_client', decision:'approved', actor_label:'client:...' }
            • approval_stage = 'approved'
            • trigger tickets_job_code_on_approve fires → job_code generated
            • tasks auto-created from request_type template
8. Operations team executes tasks; logs time
9. On task completion → ticket transitions to 'delivered'
       └─► trigger tickets_to_billable fires → billables row inserted
10. Accounts sees it in /billing, exports CSV, raises invoice
```

---

## Flow 2 — "Quick edit" that should have been billed

**Actor:** Anyone tempted to bypass the system
**Defense:** Classification is `NOT NULL` and approval_stage rules enforce the gate.

```
1. Designer receives a WhatsApp "small edit" request
2. Designer creates a ticket — UI forces classification choice
3. If marked 'included':
       • CS reviews in their queue (filter: today's included requests)
       • If CS judges it out-of-scope, they reclassify → approval flow
4. If designer skips ticket entirely and just does the work:
       • No time can be logged (time_logs requires task_id, task requires ticket)
       • Reporting flags clients with high "design hours / 0 tickets" → leakage alert
```

The system can't stop someone doing favors. It *can* make those favors visible.

---

## Flow 3 — Revision exceeds scope

**Actor:** Client Servicing
**Goal:** Stop free revisions once budget is gone.

```
1. CS creates a revision ticket (parent_ticket_id = original)
2. classifyTicket('revision') called
3. Trigger checks revisions count against clients.allowed_revisions
4a. If under budget:
       • revisions row inserted, within_scope = true
       • status='approved', no job code (folded into retainer)
4b. If over budget:
       • revisions row inserted, within_scope = false
       • classification re-set to 'extra_billable' by trigger
       • Standard approval flow kicks in
5. CS is shown an in-app note: "Revision budget exhausted — switched to Extra Billable"
```

---

## Flow 4 — Goodwill request

**Actor:** Management
**Goal:** Track free work even when nobody's paying for it.

```
1. CS classifies as 'goodwill'
2. approval_stage = 'pending_management'
3. Management approves — but no client approval phase
4. Job code generated with type 'E', metadata.goodwill = true
5. billables row inserted with amount = 0, classification = 'goodwill'
6. Leadership dashboard surfaces total goodwill ₹ value per client per month
   (computed at our internal rate card, even though we didn't charge)
```

---

## Flow 5 — Out of scope, escalated

```
1. CS classifies as 'out_of_scope'
2. ticket is moved to escalation queue
3. Management decides:
   a. Convert to change_request (formal scope expansion)
   b. Convert to extra_billable (one-off)
   c. Reject (politely decline)
4. Decision is logged in approvals
5. If change_request, a new record is created and the original ticket is closed with link
```

---

## Flow 6 — Change request

**Actor:** Account Manager (CS) → Management → Client
**Goal:** Formal scope expansion (vs. one-off Extra Billable).

Different from an extra billable: this typically modifies retainer / SOW.

```
1. AM opens /change-requests/new
2. Fills original scope, additional request, estimated cost, timeline impact
3. Submits → approval_stage='pending_management'
4. Management approves → moves to client
5. AM records client decision
6. If approved:
   • clients.retainer_amount may be updated (with audit trail)
   • clients.scope_included may be appended
   • Future tickets matching this scope are classified 'included' by default
```

---

## Flow 7 — Monthly billing close

**Actor:** Accounts
**Goal:** Reconcile billables, raise invoices, write off losses.

```
1. On the 1st of each month, scheduled function snapshots last month's billables
2. Accounts opens /billing for the period
3. For each billable:
   a. Mark 'billed' with invoice_ref
   b. Or write off with reason
4. Export CSV → Tally/Zoho import
5. Profitability MV refreshed nightly; updated picture available on Dashboard
```

---

## Flow 8 — New client onboarding

**Actor:** Management
```
1. /clients/new — fill master fields, scope items, allowed revisions
2. Assign an AM and CS team
3. System pre-creates a retainer job_code seed for the current month
4. AM receives onboarding checklist as a ticket
```

---

## Flow 9 — Daily routine for a CS exec

```
Morning
- Open /dashboard (personal view)
- See: "12 tickets awaiting client decision", "3 deadlines today"
- Triage approvals inbox

Day
- New requests come in (Typeform → webhook → tickets)
- Classify each
- Chase clients on pending approvals
- Update statuses, log notes

Evening
- Review delivered tickets for the day
- Confirm billables look correct
- Hand off to ops if work needs to continue
```

---

## Flow 10 — Daily routine for management

```
- Open /dashboard
- Scan KPI cards: MRR, extra billables this month, scope leakage
- Open approvals inbox (12 awaiting your approval)
- Bulk approve low-value items (< ₹ 5,000), individually review high-value
- Margin heatmap: any client glowing red? Drill in.
- Friday: review weekly profitability export
```
