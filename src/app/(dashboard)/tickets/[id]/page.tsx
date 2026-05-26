import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, CalendarDays, Clock, Hash, User } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { canApprove, canClassify, canSeeFinance } from '@/lib/auth/rbac';
import { getTicketById, getTicketRelations } from '@/features/tickets/queries';
import { ClassificationChip } from '@/components/data/classification-chip';
import {
  ApprovalStageChip,
  BillingStatusChip,
  TicketStatusChip,
  TaskStatusChip,
} from '@/components/data/status-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime, formatDate, timeAgo, initials } from '@/lib/utils';
import { ClassificationDialog } from '@/features/tickets/ticket-actions/classification-dialog';
import { ManagementApprovalDialog } from '@/features/tickets/ticket-actions/management-approval-dialog';
import { ClientApprovalDialog } from '@/features/tickets/ticket-actions/client-approval-dialog';
import { MarkDeliveredButton } from '@/features/tickets/ticket-actions/mark-delivered-button';
import { CommentBox } from '@/features/tickets/comment-box';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, ticket, relations] = await Promise.all([
    requireUser(),
    getTicketById(id),
    getTicketRelations(id),
  ]);
  if (!ticket) notFound();

  const showManagementApproval =
    canApprove(user.role) && ticket.approval_stage === 'pending_management';
  const showClientApproval =
    canClassify(user.role) && ticket.approval_stage === 'pending_client';
  // Mark-as-delivered is only meaningful after approval and before delivery
  const showMarkDelivered =
    ticket.approval_stage === 'approved' &&
    ['approved', 'in_progress', 'completed', 'on_hold'].includes(ticket.status);

  return (
    <div className="space-y-4">
      <Link
        href={'/tickets' as never}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tickets
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">#{ticket.ticket_number}</Badge>
          {ticket.job_code && (
            <Badge variant="muted" className="font-mono">{ticket.job_code}</Badge>
          )}
          <ClassificationChip value={ticket.classification} />
          <TicketStatusChip value={ticket.status} />
          {ticket.approval_stage !== 'not_required' && (
            <ApprovalStageChip value={ticket.approval_stage} />
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {ticket.description?.trim() ? (
                <p className="whitespace-pre-wrap">{ticket.description}</p>
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Tasks ({relations.tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {relations.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks yet. They'll appear once this ticket is approved or classified as
                  Included.
                </p>
              ) : (
                relations.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm"
                  >
                    <TaskStatusChip value={t.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.users?.full_name ?? 'Unassigned'} · due {formatDate(t.due_date)} ·
                        est {t.estimated_hours ?? 0}h
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {t.completion_pct}%
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {relations.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No approvals required (or yet to be requested).
                </p>
              ) : (
                <ol className="relative space-y-3 border-l pl-4">
                  {relations.approvals.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">
                          {a.stage.replace('_', ' ')}
                        </span>
                        <Badge variant={badgeForDecision(a.decision)}>{a.decision}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(a.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.actor?.full_name ?? a.actor_label ?? 'System'}
                        {a.comment && <span> · {a.comment}</span>}
                        {a.estimated_amount != null && (
                          <span> · {formatCurrency(a.estimated_amount)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments ({relations.comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {relations.comments.map((c) => (
                <div key={c.id} className="flex gap-3 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {initials(c.author?.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.author?.full_name ?? 'Unknown'}
                      </span>{' '}
                      · {timeAgo(c.created_at)}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
              <Separator />
              <CommentBox ticketId={ticket.id} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Client">
                <Link
                  href={`/clients?q=${ticket.client_code}` as never}
                  className="font-medium hover:underline"
                >
                  {ticket.client_name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {ticket.brand_code} · {ticket.client_code}
                </div>
              </Row>
              <Row icon={<User className="h-3.5 w-3.5" />} label="Requested by">
                {ticket.requested_by_name}
                <div className="text-xs text-muted-foreground">{ticket.requested_by_email}</div>
              </Row>
              <Row icon={<User className="h-3.5 w-3.5" />} label="Assigned to">
                {ticket.assigned_to_name ?? <span className="text-muted-foreground">—</span>}
              </Row>
              <Row icon={<Hash className="h-3.5 w-3.5" />} label="Request type">
                <span className="capitalize">{ticket.request_type}</span>
              </Row>
              <Row icon={<CalendarDays className="h-3.5 w-3.5" />} label="Deadline">
                {formatDate(ticket.deadline)}
              </Row>
              <Row icon={<Clock className="h-3.5 w-3.5" />} label="Estimated hours">
                {ticket.estimated_hours ?? '—'}
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Classification">
                <ClassificationChip value={ticket.classification} />
              </Row>
              <Row label="Approval stage">
                <ApprovalStageChip value={ticket.approval_stage} />
              </Row>
              {canSeeFinance(user.role) && (
                <>
                  <Row label="Estimated amount">{formatCurrency(ticket.estimated_amount)}</Row>
                  <Row label="Billing status">
                    <BillingStatusChip value={ticket.billing_status} />
                  </Row>
                </>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                {canClassify(user.role) && (
                  <ClassificationDialog
                    ticketId={ticket.id}
                    current={ticket.classification}
                  />
                )}
                {showManagementApproval && (
                  <ManagementApprovalDialog ticketId={ticket.id} amount={ticket.estimated_amount} />
                )}
                {showClientApproval && <ClientApprovalDialog ticketId={ticket.id} />}
                {showMarkDelivered && <MarkDeliveredButton ticketId={ticket.id} />}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-28 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {icon}
          {label}
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function badgeForDecision(decision: string) {
  if (decision === 'approved') return 'success' as const;
  if (decision === 'rejected') return 'danger' as const;
  if (decision === 'withdrawn') return 'muted' as const;
  return 'warning' as const;
}
