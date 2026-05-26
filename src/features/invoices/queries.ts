import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Invoice, InvoiceStatus } from '@/types/database.types';

export type InvoiceListFilters = {
  status?: InvoiceStatus | 'all';
  brand?: string;
  period?: string; // YYYY-MM
  clientId?: string;
};

export type InvoiceRow = Invoice & {
  client: {
    client_name: string;
    client_code: string;
    brand_code: string;
    billing_email: string | null;
    account_manager_id: string | null;
  } | null;
};

export async function listInvoices(filters: InvoiceListFilters = {}): Promise<InvoiceRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from('invoices')
    .select(
      '*, client:clients(client_name, client_code, brand_code, billing_email, account_manager_id)',
    )
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.brand) q = q.eq('brand_code', filters.brand);
  if (filters.period) q = q.eq('billing_period', filters.period);
  if (filters.clientId) q = q.eq('client_id', filters.clientId);

  const { data } = await q;
  return (data ?? []) as InvoiceRow[];
}

export async function getInvoiceById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      '*, client:clients(*), account_manager:clients(account_manager_id)',
    )
    .eq('id', id)
    .single();
  if (!invoice) return null;

  const { data: lineItems } = await supabase
    .from('billables')
    .select(
      '*, ticket:tickets(title, ticket_number), job_code:job_codes(code)',
    )
    .eq('invoice_id', id)
    .order('created_at');

  return { invoice, lineItems: lineItems ?? [] };
}
