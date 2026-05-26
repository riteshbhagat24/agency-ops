import { requireRole } from '@/lib/auth/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/data/kpi-card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { LeakageChart } from '@/components/charts/leakage-chart';
import { TeamUtilizationChart } from '@/components/charts/team-utilization';
import {
  getDashboardKpis,
  getLeakageTrend,
  getRevenueByClient,
  getTeamUtilization,
} from '@/features/dashboard/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfitabilityChip } from '@/components/data/profitability-chip';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requireRole('super_admin', 'management', 'accounts');
  const supabase = await createSupabaseServerClient();

  const [kpis, revenue, leakage, utilization, profitabilityRows] = await Promise.all([
    getDashboardKpis(),
    getRevenueByClient(),
    getLeakageTrend(),
    getTeamUtilization(),
    supabase
      .from('clients')
      .select('id, client_name, client_code, brand_code, retainer_amount, profitability_status, allowed_revisions')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('retainer_amount', { ascending: false }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Leadership view — margin protection, leakage, and team load.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" value={formatCurrency(kpis.mrr, true)} />
        <KpiCard
          label="Extra billables (this month)"
          value={formatCurrency(kpis.extraBilled, true)}
          tone="warning"
        />
        <KpiCard label="Pending billing" value={formatCurrency(kpis.pendingBilling, true)} tone="info" />
        <KpiCard label="Goodwill" value={formatCurrency(kpis.goodwill, true)} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue per client</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Retainer + Extra (this month)</p>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope leakage trend</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 6 months</p>
          </CardHeader>
          <CardContent>
            <LeakageChart data={leakage} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team utilization</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 7 days</p>
          </CardHeader>
          <CardContent>
            <TeamUtilizationChart data={utilization} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client profitability snapshot</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Active retainers</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Retainer</th>
                    <th className="px-4 py-2">Profit.</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitabilityRows.data ?? []).map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{r.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.brand_code} · {r.client_code}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs font-medium">
                        {formatCurrency(r.retainer_amount, true)}
                      </td>
                      <td className="px-4 py-2">
                        <ProfitabilityChip value={r.profitability_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
