import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { canSeeFinance } from '@/lib/auth/rbac';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClassificationChip } from '@/components/data/classification-chip';
import { BillingStatusChip } from '@/components/data/status-chip';
import { KpiCard } from '@/components/data/kpi-card';
import { formatCurrency } from '@/lib/utils';
import { BillingPeriodPicker } from '@/features/billing/period-picker';

export const dynamic = 'force-dynamic';

interface BillableRow {
  id: string;
  amount: number;
  currency: string;
  classification: 'extra_billable' | 'revision' | 'out_of_scope' | 'goodwill' | 'included';
  status: 'not_billable' | 'pending_billing' | 'billed' | 'written_off';
  invoice_id: string | null;
  invoiced_at: string | null;
  created_at: string;
  billing_period: string;
  ticket: { id: string; title: string; ticket_number: number } | null;
  client: { client_name: string; client_code: string; brand_code: string } | null;
  jc: { code: string } | null;
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    total: number;
    issued_at: string | null;
  } | null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = sp.period ?? new Date().toISOString().slice(0, 7);

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from('billables')
    .select(
      [
        'id, amount, currency, classification, status, invoice_id, invoiced_at, created_at, billing_period',
        'ticket:tickets(id, title, ticket_number, deleted_at)',
        'client:clients(client_name, client_code, brand_code)',
        'jc:job_codes(code)',
        'invoice:invoices!billables_invoice_id_fkey(id, invoice_number, status, total, issued_at)',
      ].join(', '),
    )
    .eq('billing_period', period)
    .order('created_at', { ascending: false });

  if (sp.status && sp.status !== 'all') {
    q = q.eq('status', sp.status as 'pending_billing' | 'billed' | 'written_off');
  }
  const { data: raw } = await q;
  const rows = (raw ?? []) as unknown as BillableRow[];

  let pendingTotal = 0;
  let billedTotal = 0;
  let goodwillTotal = 0;
  for (const r of rows) {
    const amt = Number(r.amount ?? 0);
    if (r.status === 'pending_billing') pendingTotal += amt;
    if (r.status === 'billed') billedTotal += amt;
    if (r.classification === 'goodwill') goodwillTotal += amt;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Approved extra requests, revisions, and goodwill. Export to your invoicing system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BillingPeriodPicker initial={period} />
          {canSeeFinance(user.role) && (
            <Button variant="outline" asChild>
              <Link
                href={`/api/exports/billing?period=${period}&format=csv` as never}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Export CSV
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Pending billing"
          value={formatCurrency(pendingTotal, true)}
          tone="warning"
          hint={`${rows.filter((r) => r.status === 'pending_billing').length} items`}
        />
        <KpiCard
          label="Billed (this period)"
          value={formatCurrency(billedTotal, true)}
          tone="success"
          hint={`${rows.filter((r) => r.status === 'billed').length} invoices raised`}
        />
        <KpiCard
          label="Goodwill (free work)"
          value={formatCurrency(goodwillTotal, true)}
          tone="warning"
          hint="Tracked but not billed"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="max-w-sm">
                <h3 className="text-base font-medium">Nothing to bill for {period}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approved extra requests will appear here once tickets are delivered.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Job code</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Ticket</th>
                    <th className="px-4 py-2.5">Classification</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs">{b.jc?.code ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.client?.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.client?.brand_code} · {b.client?.client_code}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {b.ticket && (
                          <Link
                            href={`/tickets/${b.ticket.id}` as never}
                            className="text-sm font-medium hover:underline"
                          >
                            {b.ticket.title}
                          </Link>
                        )}
                        <div className="text-xs text-muted-foreground">
                          #{b.ticket?.ticket_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ClassificationChip value={b.classification} />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {formatCurrency(b.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <BillingStatusChip value={b.status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {b.invoice ? (
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/invoices/${b.invoice.id}` as never}
                              className="font-mono text-[11px] font-medium hover:underline"
                              title="Open invoice"
                            >
                              {b.invoice.invoice_number}
                            </Link>
                            <Link
                              href={`/invoices/${b.invoice.id}/print` as never}
                              target="_blank"
                              className="inline-flex items-center gap-0.5 rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                              title="Open printable PDF view"
                            >
                              <FileText className="h-3 w-3" /> PDF
                            </Link>
                            <Badge variant="muted" className="ml-1 text-[10px] capitalize">
                              {b.invoice.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
