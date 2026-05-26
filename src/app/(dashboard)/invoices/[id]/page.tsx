import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { requireRole } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getInvoiceById } from '@/features/invoices/queries';
import { formatMoney, taxLabel } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils';
import { ClassificationChip } from '@/components/data/classification-chip';
import { InvoiceStatusActions } from '@/features/invoices/invoice-status-actions';
import {
  EditInvoiceDialog,
  AddLineItemDialog,
} from '@/features/invoices/edit-invoice-dialog';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('super_admin', 'management', 'accounts');
  const { id } = await params;
  const data = await getInvoiceById(id);
  if (!data) notFound();
  const { invoice, lineItems } = data;
  const client = invoice.client as {
    client_name: string;
    client_code: string;
    brand_name: string;
    brand_code: string;
    billing_name: string | null;
    billing_address: string | null;
    billing_email: string | null;
    gstin: string | null;
    country: string;
    payment_terms_days: number;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={'/invoices' as never}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Invoices
        </Link>
        <div className="flex items-center gap-2">
          <AddLineItemDialog invoiceId={invoice.id} currency={invoice.currency} />
          <EditInvoiceDialog
            id={invoice.id}
            subtotal={Number(invoice.subtotal)}
            taxRate={Number(invoice.tax_rate)}
            notes={invoice.notes}
            dueAt={invoice.due_at}
            currency={invoice.currency}
          />
          <Button asChild size="sm" className="gap-1.5">
            <Link
              href={`/invoices/${invoice.id}/print` as never}
              target="_blank"
            >
              <Download className="h-3.5 w-3.5" /> Download / Print
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-start justify-between border-b bg-muted/40 p-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {client?.brand_name}
              </div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {invoice.invoice_number}
              </div>
              <Badge variant="muted" className="mt-2 capitalize">
                {invoice.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Issued: {formatDate(invoice.issued_at) ?? '—'}</div>
              <div>Due: {formatDate(invoice.due_at)}</div>
              <div>Period: {invoice.billing_period}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border-b p-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Bill to
              </div>
              <div className="mt-1.5 font-medium">
                {client?.billing_name ?? client?.client_name}
              </div>
              {client?.billing_address && (
                <div className="whitespace-pre-line text-xs text-muted-foreground">
                  {client.billing_address}
                </div>
              )}
              {client?.gstin && (
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">GSTIN:</span> {client.gstin}
                </div>
              )}
              {client?.billing_email && (
                <div className="text-xs text-muted-foreground">{client.billing_email}</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Summary
              </div>
              <dl className="mt-1.5 space-y-1 text-sm">
                <Row label="Subtotal">{formatMoney(invoice.subtotal, invoice.currency)}</Row>
                {Number(invoice.tax_amount) > 0 && (
                  <Row label={`${taxLabel(client?.country)} @ ${invoice.tax_rate}%`}>
                    {formatMoney(invoice.tax_amount, invoice.currency)}
                  </Row>
                )}
                <Row label="Total" emphasis>
                  {formatMoney(invoice.total, invoice.currency)}
                </Row>
              </dl>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold">Line items ({lineItems.length})</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Job code</th>
                  <th className="py-2">Ticket</th>
                  <th className="py-2">Type</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{b.job_code?.code ?? '—'}</td>
                    <td className="py-2">
                      {b.ticket?.title}
                      <div className="text-xs text-muted-foreground">
                        #{b.ticket?.ticket_number}
                      </div>
                    </td>
                    <td className="py-2">
                      <ClassificationChip value={b.classification} />
                    </td>
                    <td className="py-2 text-right text-xs font-medium">
                      {formatMoney(b.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceStatusActions id={invoice.id} currentStatus={invoice.status} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <dt className={emphasis ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd className={emphasis ? 'font-semibold' : ''}>{children}</dd>
    </div>
  );
}
