import { cn } from '@/lib/utils';
import type { Classification } from '@/types/database.types';

const STYLE: Record<Classification, { bg: string; dot: string; label: string }> = {
  included: {
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
    dot: 'bg-emerald-500',
    label: 'Included',
  },
  extra_billable: {
    bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/20',
    dot: 'bg-orange-500',
    label: 'Extra Billable',
  },
  revision: {
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20',
    dot: 'bg-blue-500',
    label: 'Revision',
  },
  out_of_scope: {
    bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
    dot: 'bg-rose-500',
    label: 'Out of Scope',
  },
  goodwill: {
    bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20',
    dot: 'bg-purple-500',
    label: 'Goodwill',
  },
};

export function ClassificationChip({
  value,
  className,
  size = 'sm',
}: {
  value: Classification | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (!value) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
          'bg-muted text-muted-foreground ring-border',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        Unclassified
      </span>
    );
  }
  const s = STYLE[value];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ring-1 ring-inset',
        size === 'sm' ? 'text-xs' : 'text-sm px-2.5 py-1',
        s.bg,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export const CLASSIFICATION_OPTIONS: { value: Classification; label: string; hint: string }[] = [
  { value: 'included', label: 'Included', hint: 'In the retainer, no approval needed' },
  { value: 'extra_billable', label: 'Extra Billable', hint: 'Bills the client — needs mgmt + client approval' },
  { value: 'revision', label: 'Revision', hint: 'Checks budget; converts to Extra Billable if exhausted' },
  { value: 'out_of_scope', label: 'Out of Scope', hint: 'Escalates to management for decision' },
  { value: 'goodwill', label: 'Goodwill', hint: 'Free work, tracked for visibility' },
];
