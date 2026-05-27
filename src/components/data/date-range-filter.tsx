'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DateRangeFilterProps {
  basePath: string;
  fromParam?: string;
  toParam?: string;
}

export function DateRangeFilter({
  basePath,
  fromParam = 'from',
  toParam = 'to',
}: DateRangeFilterProps) {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get(fromParam) ?? '';
  const to = params.get(toParam) ?? '';

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete('page');
      router.replace(`${basePath}?${sp.toString()}`);
    },
    [params, router, basePath],
  );

  const hasRange = from || to;

  return (
    <div className="flex items-center gap-1.5">
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="date"
        value={from}
        onChange={(e) => update({ [fromParam]: e.target.value || undefined })}
        className="h-8 w-[130px] text-xs"
        title="From date"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => update({ [toParam]: e.target.value || undefined })}
        className="h-8 w-[130px] text-xs"
        title="To date"
      />
      {hasRange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => update({ [fromParam]: undefined, [toParam]: undefined })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
