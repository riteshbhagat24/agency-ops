# Wireframes (ASCII low-fidelity)

These are intent wireframes. Production layouts use ShadCN + Tailwind tokens defined in `src/styles/tokens.css`.

---

## Global shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ╔════╗                                                          🔍 ⌘K   🔔  │
│  ║ AO ║   Agency Ops                              [⌃K command palette]  👤  │
│  ╚════╝                                                                     │
├─────────┬───────────────────────────────────────────────────────────────────┤
│         │                                                                   │
│  ⌂ Dash │   Page title                                          [Action ▾] │
│  ◉ Tic… │   ──────────────────────────────────────────────────────────────  │
│  ⊟ Clt  │                                                                   │
│  ✓ Tsk  │   < page content >                                                │
│  ⚑ Apv  │                                                                   │
│  ₹ Bil  │                                                                   │
│  ⌘ Ana  │                                                                   │
│  ⚙ Set  │                                                                   │
│         │                                                                   │
│  ──── │                                                                   │
│  Ritesh │                                                                   │
│  Mgmt   │                                                                   │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

- Left rail collapses to icons at ≤ 1280px
- Top right: search, command palette trigger, notifications bell with unread badge, avatar menu

---

## Leadership Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                          This month ▾   Export ▾ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ MRR         │ │ Extra Bill. │ │ Pending Bill│ │ Goodwill ₹  │            │
│ │ ₹ 42.6L     │ │ ₹ 6.4L      │ │ ₹ 1.8L      │ │ ₹ 92k       │            │
│ │ ▲ 8.2% mom  │ │ ▲ 22%       │ │ 14 tickets  │ │ 11 tickets  │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                             │
│ ┌──────────────────────────────────┐ ┌──────────────────────────────────┐ │
│ │ Revenue per client (Top 10)      │ │ Margin risk heatmap              │ │
│ │ [stacked bar: retainer / extra]  │ │ [client × month grid]            │ │
│ └──────────────────────────────────┘ └──────────────────────────────────┘ │
│                                                                             │
│ ┌──────────────────────────────────┐ ┌──────────────────────────────────┐ │
│ │ Scope leakage trend              │ │ Team utilization                 │ │
│ │ [line chart: goodwill, unbilled] │ │ [horizontal bars per team]       │ │
│ └──────────────────────────────────┘ └──────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Awaiting your approval (12)                                  See all →  ││
│ │ ┌───────────────────────────────────────────────────────────────────┐  ││
│ │ │ FM-TATA-0526-E07  3 reels reshoot           ₹ 18,000  [Approve] │  ││
│ │ │ FM-IVAS-0526-E03  Strategy deck            Goodwill   [Approve] │  ││
│ │ │ OV-HIRA-0526-E02  Extra long-form video    ₹ 45,000  [Approve] │  ││
│ │ └───────────────────────────────────────────────────────────────────┘  ││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tickets — list (`/tickets`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Tickets                                  [+ New Ticket]  [Filter ▾] [⌄CSV] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Quick filters: [ Mine ] [ Awaiting class. ] [ Pending approval ] [ Today ]  │
│                                                                             │
│ ┌─────────┬────────┬─────────────────┬──────────┬─────────┬───────┬───────┐│
│ │ #       │ Client │ Title           │ Class.   │ Status  │ Owner │ Due   ││
│ ├─────────┼────────┼─────────────────┼──────────┼─────────┼───────┼───────┤│
│ │ #1042   │ TATA   │ 3 extra reels   │ 🟠 Extra │ Wait Ap │ Priya │ 2d    ││
│ │ #1041   │ IVAS   │ Logo cleanup    │ 🟢 Incl. │ In Prog │ Rohan │ 6h    ││
│ │ #1040   │ ONIDA  │ Reedit reel #4  │ 🔵 Rev.  │ In Prog │ Aman  │ 1d    ││
│ │ #1039   │ HIRA   │ Brand workshop  │ 🔴 OOS   │ Escal.  │ —     │ —     ││
│ │ #1038   │ TATA   │ Anniv. wishes   │ 🟣 GW    │ Apprvd  │ Priya │ 4h    ││
│ └─────────┴────────┴─────────────────┴──────────┴─────────┴───────┴───────┘│
│                                                                             │
│ Showing 1–25 of 312   ‹ 1 2 3 … 13 ›                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

Classification chips use the same color tokens everywhere:
`included #16A34A`, `extra_billable #F97316`, `revision #2563EB`, `out_of_scope #DC2626`, `goodwill #9333EA`.

---

## Ticket detail (`/tickets/[id]`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ‹ Tickets                                                                   │
│                                                                             │
│  #1042  3 extra reels reshoot for TATA spring campaign                      │
│  FM-TATA-0526-E07           🟠 Extra Billable     ● Waiting client approval│
│                                                                             │
│ ┌──────────────────────────────────────────┬────────────────────────────┐  │
│ │ Description                              │ Properties                  │ │
│ │ Client requested reshoot of reels 4,5,6  │ Client: Tata Comm.          │ │
│ │ — original deliverables already signed   │ Requested by: Priya         │ │
│ │ off. Estimated ₹ 18,000 + shoot day.     │ Assigned: Video Team        │ │
│ │                                          │ Priority: High              │ │
│ │ Attachments:                             │ Deadline: May 24, 2026       │ │
│ │  📎 brief.pdf  📎 wa-approval.png        │ Est. hours: 18              │ │
│ │                                          │ Job code: FM-TATA-0526-E07  │ │
│ │ Tasks (3)                                │                              │ │
│ │  ☐ Reshoot reel 4   Aman   May 21        │ ── Commercial ──             │ │
│ │  ☐ Reshoot reel 5   Aman   May 22        │ Classification: 🟠 Extra    │ │
│ │  ☐ Edit + deliver   Tanvi  May 24        │ Est. amount: ₹ 18,000        │ │
│ │                                          │ Bill status: Pending         │ │
│ │ Approvals timeline                       │                              │ │
│ │  • CS classified Extra Billable  10:12   │ [ Change classification ]    │ │
│ │  • Mgmt approved (Ritesh)        10:48   │ [ Record client decision ]   │ │
│ │  • Awaiting client (rahul@tata.com)      │                              │ │
│ │                                          │                              │ │
│ │ Comments                                 │                              │ │
│ │  Priya  10:15   "Client sent on WA — I  │                              │ │
│ │  attached the screenshot above."         │                              │ │
│ │  [+ Add a comment]                       │                              │ │
│ └──────────────────────────────────────────┴────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Intake form (`/tickets/new`)

Two-column wizard, RHF + Zod, server-action submit.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ New request                                                          ✕      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Client *                                                                   │
│ [ Tata Communications              ▾ ]                                     │
│                                                                             │
│ Title *                                                                    │
│ [ ____________________________________________________________ ]            │
│                                                                             │
│ Request type *                Priority                                      │
│ [ Reel              ▾ ]       [ High ▾ ]                                   │
│                                                                             │
│ Description                                                                │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ Deadline                  Estimated hours                                  │
│ [ 2026-05-24 ]            [ 18 ]                                           │
│                                                                             │
│ Assigned team                                                              │
│ ( ) Operations   (•) Video Team   ( ) Design Team                          │
│                                                                             │
│ Attachments  [+ Upload]                                                    │
│                                                                             │
│ ── Commercial classification (mandatory) ──────────────────────────────── │
│   (•) Included            ( ) Extra Billable     ( ) Revision              │
│   ( ) Out of Scope        ( ) Goodwill                                     │
│                                                                             │
│ ℹ Extra Billable / Goodwill / Out of Scope require management approval.   │
│                                                                             │
│                                              [ Cancel ] [ Create ticket ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Approvals inbox (`/approvals`)

Split view: list on left, detail preview on right.

```
┌────────────────────────────┬────────────────────────────────────────────────┐
│ Approvals (12)             │ #1042  3 extra reels reshoot                   │
├────────────────────────────┤ FM-TATA-0526-E07   🟠 Extra Billable           │
│ Filters: [Mgmt ▾] [All ▾]  │                                                │
│                            │ Requested by Priya · 32 min ago                │
│ ┌──────────────────────┐  │ Estimated ₹ 18,000 · 18h                       │
│ │ FM-TATA  Reel reshoot│  │                                                │
│ │ ₹ 18,000     32m ago │  │ Description:                                   │
│ │ Priya  → Mgmt        │  │ Client requested reshoot of reels 4,5,6 — orig │
│ └──────────────────────┘  │ deliverables already signed off…               │
│ ┌──────────────────────┐  │                                                │
│ │ OV-HIRA  Long video  │  │ Comment (optional)                             │
│ │ ₹ 45,000      1h ago │  │ [_______________________________________]      │
│ │ Rohan  → Mgmt        │  │                                                │
│ └──────────────────────┘  │ [ Reject ]          [ Approve & request client]│
│ ┌──────────────────────┐  │                                                │
│ │ FM-IVAS  Strategy    │  │                                                │
│ │ Goodwill      2h ago │  │                                                │
│ │ Priya  → Mgmt        │  │                                                │
│ └──────────────────────┘  │                                                │
└────────────────────────────┴────────────────────────────────────────────────┘
```

---

## Clients (`/clients`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Clients                                                  [+ New Client]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┬─────────┬──────────┬─────────────┬──────────┬────────────────┐│
│ │ Code     │ Brand   │ Retainer │ Profit.     │ AM       │ Status         ││
│ ├──────────┼─────────┼──────────┼─────────────┼──────────┼────────────────┤│
│ │ TATA     │ FM      │ ₹3.50L   │ 🟢 Healthy  │ Priya M  │ Active         ││
│ │ IVAS     │ FM      │ ₹1.20L   │ 🟡 At risk  │ Rohan S  │ Active         ││
│ │ HIRA     │ OV      │ ₹2.00L   │ 🔴 Bleeding │ Tanvi K  │ Active         ││
│ │ ONIDA    │ FM      │ ₹0.90L   │ 🟢 Healthy  │ Priya M  │ Active         ││
│ └──────────┴─────────┴──────────┴─────────────┴──────────┴────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

Client detail page = profitability tab + scope tab + tickets tab + invoices tab.

---

## Billing (`/billing`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Billing — May 2026                                          [Export CSV ▾]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status: [ Pending ▾ ]                                                       │
│                                                                             │
│ ┌──────────┬──────────────────────┬────────────┬───────────┬──────────────┐│
│ │ Job code │ Description           │ Client     │ Amount    │ Status       ││
│ ├──────────┼──────────────────────┼────────────┼───────────┼──────────────┤│
│ │ FM-TATA- │ Reel reshoot          │ Tata Comm. │ ₹ 18,000  │ Pending     ││
│ │ 0526-E07 │                       │            │           │              ││
│ │ OV-HIRA- │ Long video extra cut  │ Hira Diam. │ ₹ 45,000  │ Pending     ││
│ │ 0526-E02 │                       │            │           │              ││
│ │ FM-ONIDA-│ Branded sticker pack  │ Onida      │ ₹  9,500  │ Billed      ││
│ │ 0526-E04 │                       │            │           │ Inv #2046    ││
│ └──────────┴──────────────────────┴────────────┴───────────┴──────────────┘│
│ Totals:                                            Pending: ₹ 1.85L         │
│                                                    Billed:  ₹ 2.10L         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Empty / loading states (rules)

- Skeletons on initial mount (no spinners)
- Empty states have a one-line headline + 1 CTA
- 404 / 403 use the same template; 403 explains the role required

---

## Mobile rules

Below 768px:
- Sidebar collapses to a bottom tab bar (Dashboard / Tickets / Tasks / More)
- Tables become card lists
- Detail pages become a single column (properties below description)
