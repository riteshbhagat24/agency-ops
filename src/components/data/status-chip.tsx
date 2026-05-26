import { cn } from '@/lib/utils';
import type { TicketStatus, ApprovalStage, TaskStatus, BillingStatus } from '@/types/database.types';

const TICKET_STATUS_STYLE: Record<TicketStatus, { tone: string; label: string }> = {
  pending_classification: { tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', label: 'Pending Class.' },
  approved: { tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'Approved' },
  in_progress: { tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', label: 'In Progress' },
  waiting_approval: { tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', label: 'Waiting Approval' },
  completed: { tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'Completed' },
  delivered: { tone: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300', label: 'Delivered' },
  on_hold: { tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', label: 'On Hold' },
  rejected: { tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', label: 'Rejected' },
  cancelled: { tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', label: 'Cancelled' },
};

const APPROVAL_STAGE_STYLE: Record<ApprovalStage, { tone: string; label: string }> = {
  not_required: { tone: 'bg-muted text-muted-foreground', label: '—' },
  pending_management: { tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', label: 'Mgmt review' },
  pending_client: { tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', label: 'Client review' },
  approved: { tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'Approved' },
  rejected: { tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', label: 'Rejected' },
};

const TASK_STATUS_STYLE: Record<TaskStatus, { tone: string; label: string }> = {
  pending: { tone: 'bg-muted text-muted-foreground', label: 'Pending' },
  in_progress: { tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', label: 'In Progress' },
  waiting_approval: { tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', label: 'Wait Approval' },
  completed: { tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'Completed' },
  delivered: { tone: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300', label: 'Delivered' },
  on_hold: { tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', label: 'On Hold' },
};

const BILLING_STATUS_STYLE: Record<BillingStatus, { tone: string; label: string }> = {
  not_billable: { tone: 'bg-muted text-muted-foreground', label: 'Not billable' },
  pending_billing: { tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', label: 'Pending' },
  billed: { tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'Billed' },
  written_off: { tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', label: 'Written off' },
};

export function TicketStatusChip({ value, className }: { value: TicketStatus; className?: string }) {
  const s = TICKET_STATUS_STYLE[value];
  return <Chip tone={s.tone} className={className}>{s.label}</Chip>;
}

export function ApprovalStageChip({ value, className }: { value: ApprovalStage; className?: string }) {
  const s = APPROVAL_STAGE_STYLE[value];
  return <Chip tone={s.tone} className={className}>{s.label}</Chip>;
}

export function TaskStatusChip({ value, className }: { value: TaskStatus; className?: string }) {
  const s = TASK_STATUS_STYLE[value];
  return <Chip tone={s.tone} className={className}>{s.label}</Chip>;
}

export function BillingStatusChip({ value, className }: { value: BillingStatus; className?: string }) {
  const s = BILLING_STATUS_STYLE[value];
  return <Chip tone={s.tone} className={className}>{s.label}</Chip>;
}

function Chip({ tone, className, children }: { tone: string; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}
