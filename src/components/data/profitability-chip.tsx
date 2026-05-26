import { cn } from '@/lib/utils';
import type { ProfitabilityStatus, ClientStatus } from '@/types/database.types';

export function ProfitabilityChip({ value }: { value: ProfitabilityStatus }) {
  const style: Record<ProfitabilityStatus, { dot: string; label: string; bg: string }> = {
    healthy: { dot: 'bg-emerald-500', label: 'Healthy', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    at_risk: { dot: 'bg-amber-500', label: 'At risk', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    bleeding: { dot: 'bg-rose-500', label: 'Bleeding', bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
    unknown: { dot: 'bg-slate-400', label: 'Unknown', bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  };
  const s = style[value];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        s.bg,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function ClientStatusChip({ value }: { value: ClientStatus }) {
  const style: Record<ClientStatus, string> = {
    active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    paused: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    churned: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    prospect: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        style[value],
      )}
    >
      {value}
    </span>
  );
}
