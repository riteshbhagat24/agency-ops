import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  await requireRole('super_admin', 'management', 'accounts');

  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? new Date().toISOString().slice(0, 7);
  const format = url.searchParams.get('format') ?? 'csv';

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('billables')
    .select(
      'amount, currency, classification, status, invoice_ref, invoiced_at, billing_period, created_at, ticket:tickets(title, ticket_number), client:clients(client_name, client_code, brand_code), jc:job_codes(code)',
    )
    .eq('billing_period', period)
    .order('created_at');

  if (format === 'json') {
    return NextResponse.json({ ok: true, data });
  }

  // CSV
  const headers = [
    'job_code',
    'brand',
    'client_code',
    'client_name',
    'ticket_number',
    'title',
    'classification',
    'amount',
    'currency',
    'status',
    'invoice_ref',
    'invoiced_at',
    'billing_period',
  ];
  const rows = (data ?? []).map((r: any) => [
    r.jc?.code ?? '',
    r.client?.brand_code ?? '',
    r.client?.client_code ?? '',
    r.client?.client_name ?? '',
    r.ticket?.ticket_number ?? '',
    csvEscape(r.ticket?.title ?? ''),
    r.classification,
    r.amount,
    r.currency,
    r.status,
    r.invoice_ref ?? '',
    r.invoiced_at ?? '',
    r.billing_period,
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="billing-${period}.csv"`,
    },
  });
}

function csvEscape(s: string) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
