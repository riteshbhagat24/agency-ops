import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Client } from '@/types/database.types';

export type ClientRow = Client & {
  account_manager: { full_name: string } | null;
};

export async function listClients() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('clients')
    .select('*, account_manager:users!clients_account_manager_id_fkey(full_name)')
    .is('deleted_at', null)
    .order('client_name');
  return (data ?? []) as ClientRow[];
}

export async function getClientById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('clients')
    .select('*, account_manager:users!clients_account_manager_id_fkey(full_name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return (data as ClientRow) ?? null;
}

export async function getClientStats(id: string) {
  const supabase = await createSupabaseServerClient();
  const period = new Date().toISOString().slice(0, 7);
  const [tickets, billables, revisions] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, classification, status, estimated_amount', { count: 'exact' })
      .eq('client_id', id)
      .is('deleted_at', null),
    supabase
      .from('billables')
      .select('amount, classification, status, billing_period')
      .eq('client_id', id),
    supabase
      .from('revisions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${period}-01`),
  ]);

  const totalTickets = tickets.count ?? 0;
  let openTickets = 0;
  let goodwillTickets = 0;
  for (const t of tickets.data ?? []) {
    if (t.status !== 'delivered' && t.status !== 'cancelled' && t.status !== 'rejected') {
      openTickets++;
    }
    if (t.classification === 'goodwill') goodwillTickets++;
  }

  let extraBilledMonth = 0;
  let extraBilledLifetime = 0;
  let goodwillMonth = 0;
  for (const b of billables.data ?? []) {
    const amt = Number(b.amount ?? 0);
    if (b.classification === 'extra_billable') {
      extraBilledLifetime += amt;
      if (b.billing_period === period) extraBilledMonth += amt;
    }
    if (b.classification === 'goodwill' && b.billing_period === period) {
      goodwillMonth += amt;
    }
  }

  return {
    totalTickets,
    openTickets,
    goodwillTickets,
    extraBilledMonth,
    extraBilledLifetime,
    goodwillMonth,
    revisionsThisMonth: revisions.count ?? 0,
  };
}
