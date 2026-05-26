import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireRole } from '@/lib/auth/session';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/data/kpi-card';
import { InvoiceFilters } from '@/features/invoices/invoice-filters';
import { listInvoices } from '@/features/invoices/queries';
import { formatMoney } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  sent: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  cancelled: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  written_off: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; brand?: string; period?: string }>;
}) {
  await requireRole('super_admin', 'management', 'accounts');
  const sp = await searchParams;
  const period = sp.period ?? new Date().toISOString().slice(0, 7);
  const filters = {
    status: (sp.status as InvoiceStatus | 'all') ?? 'all',
    brand: sp.brand,
    period,
  };
  const invoices = await listInvoices(filters);

  // totals
  const totals = invoices.reduce(
    (acc, i) => {
      acc.total += Number(i.total);
      if (i.status === 'paid') acc.paid += Number(i.total);
      if (i.status === 'sent' || i.status === 'overdue') acc.outstanding += Number(i.total);
      if (i.status === 'draft') acc.draft += Number(i.total);
      return acc;
    },
    { total: 0, paid: 0, outstanding: 0, draft: 0 },
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Auto-generated from approved billables. GST is applied automatically for India clients.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/api/exports/invoices?period=${period}` as never} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total billed (this period)"
          value={formatMoney(totals.total, 'INR', { compact: true })}
          hint={`${invoices.length} invoices`}
        />
        <KpiCard
          label="Outstanding"
          value={formatMoney(totals.outstanding, 'INR', { compact: true })}
          tone="warning"
          hint="Sent / overdue"
        />
        <KpiCard
          label="Paid"
          value={formatMoney(totals.paid, 'INR', { compact: true })}
          tone="success"
        />
        <KpiCard
          label="In draft"
          value={formatMoney(totals.draft, 'INR', { compact: true })}
          tone="info"
          hint="Yet to be issued"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <InvoiceFilters initial={filters} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center text-sm text-muted-foreground">
              No invoices match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Subtotal</th>
                    <th className="px-4 py-2.5">Tax</th>
                    <th className="px-4 py-2.5">Total</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/invoices/${i.id}` as never}
                          className="font-medium hover:underline"
                        >
                          {i.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.client?.client_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.client?.brand_code} · {i.client?.client_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{formatMoney(i.subtotal, i.currency)}</td>
                      <td className="px-4 py-3 text-xs">
                        {Number(i.tax_amount) > 0 ? (
                          <>
                            {formatMoney(i.tax_amount, i.currency)}
                            <div className="text-[10px] text-muted-foreground">
                              {i.tax_rate}%
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatMoney(i.total, i.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn('font-medium capitalize', STATUS_TONE[i.status])}
                          variant="muted"
                        >
                          {i.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{formatDate(i.due_at)}</td>
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
