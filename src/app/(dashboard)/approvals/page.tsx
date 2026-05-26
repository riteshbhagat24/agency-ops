import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { canApprove, canClassify } from '@/lib/auth/rbac';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClassificationChip } from '@/components/data/classification-chip';
import { ApprovalStageChip } from '@/components/data/status-chip';
import { formatCurrency, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // Management queue
  let managementQueue: any[] = [];
  if (canApprove(user.role)) {
    const { data } = await supabase
      .from('v_tickets_full')
      .select('*')
      .eq('approval_stage', 'pending_management')
      .order('created_at', { ascending: false });
    managementQueue = data ?? [];
  }

  // Client queue (for CS to record client decisions)
  let clientQueue: any[] = [];
  if (canClassify(user.role)) {
    const { data } = await supabase
      .from('v_tickets_full')
      .select('*')
      .eq('approval_stage', 'pending_client')
      .order('created_at', { ascending: false });
    clientQueue = data ?? [];
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Decisions that block billable work. Clear them to unblock the team.
        </p>
      </header>

      {canApprove(user.role) && (
        <ApprovalSection
          title="Awaiting management"
          subtitle="Your approval unlocks the next stage of the workflow."
          tickets={managementQueue}
          emptyText="Nothing waiting on management. Inbox zero."
          cta="Review"
        />
      )}

      {canClassify(user.role) && (
        <ApprovalSection
          title="Awaiting client decision"
          subtitle="Record what the client said on WhatsApp or email."
          tickets={clientQueue}
          emptyText="No client approvals pending."
          cta="Record decision"
        />
      )}
    </div>
  );
}

function ApprovalSection({
  title,
  subtitle,
  tickets,
  emptyText,
  cta,
}: {
  title: string;
  subtitle: string;
  tickets: any[];
  emptyText: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="text-xs text-muted-foreground">{tickets.length} items</div>
      </CardHeader>
      <CardContent className="p-0">
        {tickets.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <ClassificationChip value={t.classification} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tickets/${t.id}` as never}
                    className="block truncate font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.brand_code}-{t.client_code} · #{t.ticket_number} ·{' '}
                    {t.requested_by_name ?? 'Unknown'} · {timeAgo(t.created_at)}
                  </div>
                </div>
                <div className="hidden flex-col items-end gap-1 text-xs sm:flex">
                  <div className="font-medium">{formatCurrency(t.estimated_amount, true)}</div>
                  <ApprovalStageChip value={t.approval_stage} />
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/tickets/${t.id}` as never} className="gap-1">
                    {cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
