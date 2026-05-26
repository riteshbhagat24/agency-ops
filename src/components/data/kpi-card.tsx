import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  delta,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  delta?: { value: number; unit?: string } | null;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
}) {
  const isUp = (delta?.value ?? 0) > 0;
  const isDown = (delta?.value ?? 0) < 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-muted-foreground">{label}</div>
          {icon ? (
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
                tone === 'warning' && 'bg-amber-500/10 text-amber-600',
                tone === 'danger' && 'bg-rose-500/10 text-rose-600',
                tone === 'info' && 'bg-blue-500/10 text-blue-600',
                tone === 'default' && 'bg-muted text-muted-foreground',
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                isUp && 'text-emerald-600 dark:text-emerald-400',
                isDown && 'text-rose-600 dark:text-rose-400',
                !isUp && !isDown && 'text-muted-foreground',
              )}
            >
              {isUp && <ArrowUpRight className="h-3 w-3" />}
              {isDown && <ArrowDownRight className="h-3 w-3" />}
              {delta.value > 0 ? '+' : ''}
              {delta.value}
              {delta.unit ?? '%'}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
