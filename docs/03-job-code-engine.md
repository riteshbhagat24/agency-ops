# Job Code Engine

## Format

```
[Brand]-[ClientCode]-[MonthYear]-[Type][Sequence]
   FM    -   TATA   -   0526    -   E   07
```

| Segment | Source | Example |
|---------|--------|---------|
| Brand | `clients.brand_code` | `FM` (Futuready), `OV` (Orange Videos) |
| ClientCode | `clients.client_code` | `TATA`, `ONIDA`, `IVAS` |
| MonthYear | `to_char(now(),'MMYY')` | `0526` |
| Type | inferred from `ticket.request_type` / `classification` | `R/C/V/E/S` |
| Sequence | `job_code_sequences.last_seq + 1` | `07` (zero-padded to 2) |

### Type derivation

| Request shape | Type code | Notes |
|--------------|-----------|-------|
| Retainer recurring deliverable | `R` | classification = `included`, request_type in (`post`,`reel`,`story`) |
| Campaign | `C` | request_type = `campaign` |
| Video | `V` | request_type in (`video`,`reel-long`,`edit`) |
| Extra request | `E` | classification = `extra_billable` |
| Shoot | `S` | request_type = `shoot` |

Defined as a pure SQL function `derive_type_code(request_type text, classification classification) returns char(1)`.

---

## Concurrency

Two CS people approving extra requests for `TATA` in the same minute must not produce duplicate `FM-TATA-0526-E07`.

We solve this with an advisory lock per `(brand_code, client_id, month_key, type_code)`, scoped to the transaction:

```sql
-- inside generate_job_code()
perform pg_advisory_xact_lock(
  hashtext(brand_code || client_id::text || month_key || type_code)
);

-- now safe to read-modify-write the counter
update job_code_sequences
   set last_seq = last_seq + 1
 where brand_code = $brand
   and client_id  = $client
   and month_key  = $month
   and type_code  = $type
returning last_seq into v_seq;
```

If the row doesn't exist, an `INSERT ... ON CONFLICT DO UPDATE` upserts it.

`pg_advisory_xact_lock` releases at transaction end (commit/rollback), so we never leak locks.

---

## SQL implementation

```sql
create or replace function derive_type_code(
  p_request_type text,
  p_classification classification
) returns char(1)
language sql immutable as $$
  select case
    when p_classification = 'extra_billable' then 'E'
    when p_request_type = 'shoot' then 'S'
    when p_request_type in ('video','reel-long','edit') then 'V'
    when p_request_type = 'campaign' then 'C'
    else 'R'
  end::char(1);
$$;

create or replace function generate_job_code(
  p_ticket_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand     text;
  v_client_id uuid;
  v_client_code text;
  v_type      char(1);
  v_month     char(4) := to_char(now() at time zone 'Asia/Kolkata', 'MMYY');
  v_seq       int;
  v_code      text;
begin
  select c.brand_code, c.id, c.client_code,
         derive_type_code(t.request_type, t.classification)
    into v_brand, v_client_id, v_client_code, v_type
    from tickets t
    join clients c on c.id = t.client_id
   where t.id = p_ticket_id;

  if v_brand is null then
    raise exception 'ticket % not found or has no client', p_ticket_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_brand || v_client_id::text || v_month || v_type)
  );

  insert into job_code_sequences (brand_code, client_id, month_key, type_code, last_seq)
       values (v_brand, v_client_id, v_month, v_type, 1)
  on conflict (brand_code, client_id, month_key, type_code)
    do update set last_seq = job_code_sequences.last_seq + 1
    returning last_seq into v_seq;

  v_code := v_brand || '-' || v_client_code || '-' || v_month || '-' || v_type
            || lpad(v_seq::text, 2, '0');

  insert into job_codes (code, ticket_id, brand_code, client_id, month_key, type_code, sequence)
       values (v_code, p_ticket_id, v_brand, v_client_id, v_month, v_type, v_seq);

  update tickets
     set job_code_id = (select id from job_codes where code = v_code),
         updated_at  = now()
   where id = p_ticket_id;

  return v_code;
end;
$$;
```

---

## When is a job code generated?

| Trigger | Behavior |
|---------|----------|
| Classification = `included` | Generated immediately (no approval needed) |
| Classification = `revision` AND within revision budget | Not generated (folded into parent retainer) |
| Classification = `revision` AND exceeds budget | Reclassified to `extra_billable` flow |
| Classification = `extra_billable` | Generated when `approval_stage` reaches `'approved'` |
| Classification = `goodwill` | Generated when management approves (still costs us money — tracked, not billed) |
| Classification = `out_of_scope` | Generated only after escalation + decision |

The trigger `tickets_job_code_on_approve` fires on the right state transitions.

---

## Regeneration / corrections

Job codes are immutable once assigned. If finance flags a wrong classification:

1. Issue a **correction ticket** referencing the original (`parent_ticket_id`)
2. Original keeps its code; correction gets a new code with type `E` and a `metadata.correction_of` field
3. Billables view nets them out

This preserves audit history and matches how Tally / Zoho handle credit notes.
