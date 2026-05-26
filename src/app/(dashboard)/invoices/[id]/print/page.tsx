import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { getInvoiceById } from '@/features/invoices/queries';
import { formatMoney, taxLabel } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils';
import { PrintActions } from '@/features/invoices/print-actions';

export const dynamic = 'force-dynamic';

interface Client {
  client_name: string;
  client_code: string;
  brand_name: string;
  brand_code: string;
  billing_name: string | null;
  billing_address: string | null;
  billing_email: string | null;
  gstin: string | null;
  country: string;
}

interface LineItem {
  id: string;
  amount: number;
  classification: string;
  ticket: { title: string; ticket_number: number } | null;
  job_code: { code: string } | null;
}

/**
 * Print-optimized invoice. Hides app chrome via CSS, lets the user
 * use the browser's "Save as PDF" via Ctrl/Cmd+P.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('super_admin', 'management', 'accounts');
  const { id } = await params;
  const data = await getInvoiceById(id);
  if (!data) notFound();
  const { invoice, lineItems } = data;
  const client = invoice.client as Client;

  return (
    <>
      {/* Hide the app shell only when printing this route. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          html, body { background: #fff; }
          aside, header.app-topbar, .no-print, button { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
        <div className="no-print mb-6">
          <PrintActions />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">INVOICE</h1>
            <div className="mt-2 font-mono text-sm">{invoice.invoice_number}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              {client?.brand_name}
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <Row label="Issued">{formatDate(invoice.issued_at ?? invoice.created_at)}</Row>
            <Row label="Due">{formatDate(invoice.due_at)}</Row>
            <Row label="Status">
              <span className="font-medium capitalize">
                {invoice.status.replace('_', ' ')}
              </span>
            </Row>
            <Row label="Period">{invoice.billing_period}</Row>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 border-b py-6 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bill to
            </div>
            <div className="mt-1 font-medium">
              {client?.billing_name ?? client?.client_name}
            </div>
            {client?.billing_address && (
              <div className="whitespace-pre-line text-xs text-slate-600">
                {client.billing_address}
              </div>
            )}
            {client?.gstin && (
              <div className="mt-1 text-xs">
                <span className="text-slate-500">GSTIN:</span> {client.gstin}
              </div>
            )}
            {client?.billing_email && (
              <div className="text-xs text-slate-600">{client.billing_email}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              From
            </div>
            <div className="mt-1 font-medium">{client?.brand_name}</div>
            <div className="text-xs text-slate-600">
              Invoice currency: {invoice.currency}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2">Job code</th>
                <th className="py-2">Description</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(lineItems as unknown as LineItem[]).map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{b.job_code?.code ?? '—'}</td>
                  <td className="py-2">
                    {b.ticket?.title ?? '—'}
                    <div className="text-xs text-slate-500">
                      Ticket #{b.ticket?.ticket_number ?? '—'}
                    </div>
                  </td>
                  <td className="py-2 capitalize">
                    {b.classification.replace('_', ' ')}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(b.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="ml-auto w-72 space-y-1 border-t py-4 text-sm">
          <Total label="Subtotal">{formatMoney(invoice.subtotal, invoice.currency)}</Total>
          {Number(invoice.tax_amount) > 0 && (
            <Total label={`${taxLabel(client?.country)} @ ${invoice.tax_rate}%`}>
              {formatMoney(invoice.tax_amount, invoice.currency)}
            </Total>
          )}
          <Total label="Total" emphasis>
            {formatMoney(invoice.total, invoice.currency)}
          </Total>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 border-t pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {invoice.notes}
            </p>
          </div>
        )}

        <div className="mt-8 border-t pt-4 text-center text-xs text-slate-400">
          Generated by Agency Ops · {new Date().toLocaleDateString('en-IN')}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span> {children}
    </div>
  );
}

function Total({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? 'border-t pt-2 font-bold' : ''}`}>
      <span className={emphasis ? '' : 'text-slate-600'}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
