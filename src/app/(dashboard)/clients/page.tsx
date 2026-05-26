import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfitabilityChip, ClientStatusChip } from '@/components/data/profitability-chip';
import { ClientsFilters } from '@/features/clients/clients-filters';
import { formatDate } from '@/lib/utils';
import { formatMoney } from '@/lib/utils/currency';
import type { Client, ProfitabilityStatus, ClientStatus } from '@/types/database.types';

export const dynamic = 'force-dynamic';

interface ClientRow extends Client {
  account_manager: { id: string; full_name: string } | null;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; status?: string; profit?: string; am?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Build query with filters
  let query = supabase
    .from('clients')
    .select('*, account_manager:users!clients_account_manager_id_fkey(id, full_name)')
    .is('deleted_at', null)
    .order('client_name');

  if (sp.q) {
    query = query.or(`client_name.ilike.%${sp.q}%,client_code.ilike.%${sp.q}%`);
  }
  if (sp.brand && sp.brand !== 'all') query = query.eq('brand_code', sp.brand);
  if (sp.status && sp.status !== 'all')
    query = query.eq('status', sp.status as ClientStatus);
  if (sp.profit && sp.profit !== 'all')
    query = query.eq('profitability_status', sp.profit as ProfitabilityStatus);
  if (sp.am === 'none') query = query.is('account_manager_id', null);
  else if (sp.am && sp.am !== 'all') query = query.eq('account_manager_id', sp.am);

  const { data: clients } = await query;
  const rows = (clients ?? []) as ClientRow[];

  // AMs for the filter dropdown
  const { data: amCandidates } = await supabase
    .from('users')
    .select('id, full_name')
    .in('role', ['client_servicing', 'management', 'super_admin'])
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name');

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            The retainer book. {rows.length} client{rows.length === 1 ? '' : 's'} shown.
          </p>
        </div>
        <Button asChild>
          <Link href={'/clients/new' as never} className="gap-1.5">
            <Plus className="h-4 w-4" /> New client
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <ClientsFilters
            initial={{
              search: sp.q,
              brand: sp.brand,
              status: sp.status,
              profit: sp.profit,
              am: sp.am,
            }}
            ams={amCandidates ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center text-sm text-muted-foreground">
              No clients match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Brand</th>
                    <th className="px-4 py-2.5">Retainer</th>
                    <th className="px-4 py-2.5">Country</th>
                    <th className="px-4 py-2.5">Profitability</th>
                    <th className="px-4 py-2.5">AM</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Start</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {c.client_code}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/clients/${c.id}` as never}
                          className="font-medium hover:underline"
                        >
                          {c.client_name}
                        </Link>
                        {c.billing_name && c.billing_name !== c.client_name && (
                          <div className="text-xs text-muted-foreground">{c.billing_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{c.brand_code}</td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {formatMoney(c.retainer_amount, c.currency ?? 'INR', { compact: true })}
                        <div className="text-[10px] text-muted-foreground">{c.billing_cycle}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.country}
                        <div className="text-[10px] text-muted-foreground">
                          {c.tax_rate}% {c.country === 'IN' ? 'GST' : 'tax'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ProfitabilityChip value={c.profitability_status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.account_manager?.full_name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ClientStatusChip value={c.status} />
                      </td>
                      <td className="px-4 py-3 text-xs">{formatDate(c.start_date)}</td>
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
