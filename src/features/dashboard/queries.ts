import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Classification, ApprovalStage } from '@/types/database.types';

const CURRENT_PERIOD = () => new Date().toISOString().slice(0, 7);

export type DashboardKpis = {
  mrr: number;
  extraBilled: number;
  extraBilledLastMonth: number;
  pendingBilling: number;
  goodwill: number;
  goodwillLastMonth: number;
  pendingApprovals: number;
  totalRevisions: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createSupabaseServerClient();
  const period = CURRENT_PERIOD();
  const lastMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const { data: clients } = await supabase
    .from('clients')
    .select('retainer_amount')
    .eq('status', 'active')
    .is('deleted_at', null);
  const mrr = (clients ?? []).reduce((acc, r) => acc + Number(r.retainer_amount ?? 0), 0);

  // This period + last period billables (for MoM deltas)
  const { data: billables } = await supabase
    .from('billables')
    .select('amount, classification, status, billing_period')
    .in('billing_period', [period, lastMonth]);

  let extraBilled = 0;
  let extraBilledLastMonth = 0;
  let pendingBilling = 0;
  let goodwill = 0;
  let goodwillLastMonth = 0;
  for (const b of billables ?? []) {
    const amt = Number(b.amount ?? 0);
    const isCurrent = b.billing_period === period;
    if (b.classification === 'goodwill') {
      if (isCurrent) goodwill += amt;
      else goodwillLastMonth += amt;
    }
    if (b.classification === 'extra_billable') {
      if (isCurrent) extraBilled += amt;
      else extraBilledLastMonth += amt;
    }
    if (isCurrent && b.status === 'pending_billing') pendingBilling += amt;
  }

  const { count: pendingApprovals } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('approval_stage', 'pending_management' as ApprovalStage)
    .is('deleted_at', null);

  const monthStart = `${period}-01`;
  const { count: totalRevisions } = await supabase
    .from('revisions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart);

  return {
    mrr,
    extraBilled,
    extraBilledLastMonth,
    pendingBilling,
    goodwill,
    goodwillLastMonth,
    pendingApprovals: pendingApprovals ?? 0,
    totalRevisions: totalRevisions ?? 0,
  };
}

/** Percentage change. Returns null when last-month was 0 (no meaningful comparison). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getRevenueByClient() {
  const supabase = await createSupabaseServerClient();
  const period = CURRENT_PERIOD();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_code, retainer_amount')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('retainer_amount', { ascending: false })
    .limit(10);

  const { data: extras } = await supabase
    .from('billables')
    .select('client_id, amount, classification')
    .eq('billing_period', period)
    .eq('classification', 'extra_billable' as Classification);

  const extraByClient = new Map<string, number>();
  for (const e of extras ?? []) {
    extraByClient.set(e.client_id, (extraByClient.get(e.client_id) ?? 0) + Number(e.amount));
  }

  return (clients ?? []).map((c) => ({
    client: c.client_code,
    retainer: Number(c.retainer_amount ?? 0),
    extra: extraByClient.get(c.id) ?? 0,
  }));
}

export async function getLeakageTrend() {
  // Last 6 months
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('billables')
    .select('billing_period, classification, amount')
    .in('billing_period', months);

  const map = new Map<string, { goodwill: number; unbilled: number }>(
    months.map((m) => [m, { goodwill: 0, unbilled: 0 }]),
  );
  for (const b of data ?? []) {
    const e = map.get(b.billing_period);
    if (!e) continue;
    const amt = Number(b.amount ?? 0);
    if (b.classification === 'goodwill') e.goodwill += amt;
    if (b.classification === 'extra_billable' || b.classification === 'out_of_scope') {
      e.unbilled += amt;
    }
  }
  return months.map((m) => ({
    period: m.slice(5) + '/' + m.slice(2, 4),
    goodwill: map.get(m)!.goodwill,
    unbilled: map.get(m)!.unbilled,
  }));
}

export async function getTeamUtilization() {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Build dynamic per-department capacity from actual active headcount × 40h/week
  const { data: headcount } = await supabase
    .from('users')
    .select('department_id, departments(name)')
    .eq('is_active', true)
    .is('deleted_at', null);

  const capacityByDept = new Map<string, number>();
  for (const u of (headcount ?? []) as Array<{
    departments: { name: string } | null;
  }>) {
    const team = u.departments?.name;
    if (!team) continue;
    capacityByDept.set(team, (capacityByDept.get(team) ?? 0) + 40);
  }

  const { data: logs } = await supabase
    .from('time_logs')
    .select('hours, users(departments(name))')
    .gte('work_date', since);

  const hoursByDept = new Map<string, number>();
  for (const row of (logs ?? []) as Array<{
    hours: number;
    users: { departments: { name: string } | null } | null;
  }>) {
    const team = row.users?.departments?.name;
    if (!team) continue;
    hoursByDept.set(team, (hoursByDept.get(team) ?? 0) + Number(row.hours));
  }

  // Show every department that has either capacity OR logged hours
  const allTeams = new Set<string>([...capacityByDept.keys(), ...hoursByDept.keys()]);
  return Array.from(allTeams)
    .map((team) => {
      const cap = capacityByDept.get(team) ?? 40;
      const hours = hoursByDept.get(team) ?? 0;
      return { team, utilization: Math.min(100, Math.round((hours / cap) * 100)) };
    })
    .filter((t) => t.utilization > 0)
    .sort((a, b) => b.utilization - a.utilization);
}

export async function getPendingApprovals(limit = 5) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('v_tickets_full')
    .select('id, ticket_number, title, classification, estimated_amount, client_name, client_code, brand_code, created_at, requested_by_name')
    .eq('approval_stage', 'pending_management')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
