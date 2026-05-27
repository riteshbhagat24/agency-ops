'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { DateRangeFilter } from '@/components/data/date-range-filter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function InvoiceFilters({
  initial,
}: {
  initial: { status?: string; brand?: string; period?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`/invoices?${sp.toString()}`);
    },
    [params, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="month"
        defaultValue={initial.period}
        className="w-[160px]"
        onChange={(e) => update({ period: e.target.value })}
      />
      <Select value={initial.status ?? 'all'} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="written_off">Written off</SelectItem>
        </SelectContent>
      </Select>
      <Select value={initial.brand ?? 'all'} onValueChange={(v) => update({ brand: v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All brands</SelectItem>
          <SelectItem value="FRM">Futuready Media</SelectItem>
          <SelectItem value="OV">Orange Videos</SelectItem>
        </SelectContent>
      </Select>
      {(initial.status || initial.brand) && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/invoices')}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
      <DateRangeFilter basePath="/invoices" />
    </div>
  );
}
