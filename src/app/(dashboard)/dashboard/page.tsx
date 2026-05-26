import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Gift,
  IndianRupee,
  ReceiptText,
  Repeat2,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/data/kpi-card';
import { ClassificationChip } from '@/components/data/classification-chip';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { LeakageChart } from '@/components/charts/leakage-chart';
import { TeamUtilizationChart } from '@/components/charts/team-utilization';
import { requireUser } from '@/lib/auth/session';
import { formatCurrency, timeAgo } from '@/lib/utils';
import {
  getDashboardKpis,
  getLeakageTrend,
  getPendingApprovals,
  getRevenueByClient,
  getTeamUtilization,
  pctDelta,
} from '@/features/dashboard/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const [kpis, revenue, leakage, utilization, approvals] = await Promise.all([
    getDashboardKpis(),
    getRevenueByClient(),
    getLeakageTrend(),
    getTeamUtilization(),
    getPendingApprovals(5),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {greeting()}, {user.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's where the agency stands this month.
          </p>
        </div>
        <Button asChild>
          <Link href={'/tickets/new' as never}>New ticket</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="MRR (active retainers)"
          value={formatCurrency(kpis.mrr, true)}
          hint={`${revenue.length} active clients`}
          tone="info"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Extra billables (this month)"
          value={formatCurrency(kpis.extraBilled, true)}
          delta={
            pctDelta(kpis.extraBilled, kpis.extraBilledLastMonth) != null
              ? { value: pctDelta(kpis.extraBilled, kpis.extraBilledLastMonth)! }
              : null
          }
          hint={
            kpis.pendingApprovals > 0
              ? `${kpis.pendingApprovals} pending mgmt approval`
              : 'vs last month'
          }
          tone="warning"
          icon={<ReceiptText className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Pending billing"
          value={formatCurrency(kpis.pendingBilling, true)}
          hint="Awaiting invoice"
          tone="info"
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Goodwill (free work)"
          value={formatCurrency(kpis.goodwill, true)}
          delta={
            pctDelta(kpis.goodwill, kpis.goodwillLastMonth) != null
              ? { value: pctDelta(kpis.goodwill, kpis.goodwillLastMonth)! }
              : null
          }
          hint="vs last month"
          tone="warning"
          icon={<Gift className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Revenue per client</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Retainer + extra billables · top 10
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={'/clients' as never}>
                View clients <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope leakage trend</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Goodwill + out-of-scope unbilled value, last 6 months
            </p>
          </CardHeader>
          <CardContent>
            <LeakageChart data={leakage} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Awaiting management approval</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Decisions block billable work
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={'/approvals' as never}>
                Open inbox <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {approvals.length === 0 ? (
              <div className="grid place-items-center py-8 text-sm text-muted-foreground">
                Nothing waiting on you. Inbox zero. 🎉
              </div>
            ) : (
              <ul className="divide-y">
                {approvals.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <ClassificationChip value={a.classification} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tickets/${a.id}` as never}
                        className="block truncate font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.brand_code}-{a.client_code} · #{a.ticket_number} · {a.requested_by_name ?? '—'}
                      </div>
                    </div>
                    <div className="hidden text-right text-xs sm:block">
                      <div className="font-medium">{formatCurrency(a.estimated_amount, true)}</div>
                      <div className="text-muted-foreground">{timeAgo(a.created_at)}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/tickets/${a.id}` as never}>Review</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team utilization</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 7 days</p>
          </CardHeader>
          <CardContent>
            <TeamUtilizationChart data={utilization} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Goodwill this month</div>
              <div className="text-lg font-semibold">{formatCurrency(kpis.goodwill)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Repeat2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Revisions this month</div>
              <div className="text-lg font-semibold">{kpis.totalRevisions}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Awaiting your call</div>
              <div className="text-lg font-semibold">{kpis.pendingApprovals} approvals</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
