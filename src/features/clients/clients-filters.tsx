'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
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

interface UserLite {
  id: string;
  full_name: string;
}

interface ClientsFiltersProps {
  initial: { search?: string; brand?: string; status?: string; profit?: string; am?: string };
  ams: UserLite[];
}

export function ClientsFilters({ initial, ams }: ClientsFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`/clients?${sp.toString()}`);
    },
    [params, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or code…"
          defaultValue={initial.search ?? ''}
          className="pl-8"
          onChange={(e) => update({ q: e.target.value || undefined })}
        />
      </div>
      <Select value={initial.brand ?? 'all'} onValueChange={(v) => update({ brand: v })}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All brands</SelectItem>
          <SelectItem value="FRM">Futuready Media</SelectItem>
          <SelectItem value="OV">Orange Videos</SelectItem>
        </SelectContent>
      </Select>
      <Select value={initial.status ?? 'all'} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
          <SelectItem value="prospect">Prospect</SelectItem>
          <SelectItem value="churned">Churned</SelectItem>
        </SelectContent>
      </Select>
      <Select value={initial.profit ?? 'all'} onValueChange={(v) => update({ profit: v })}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Profitability" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="healthy">Healthy</SelectItem>
          <SelectItem value="at_risk">At risk</SelectItem>
          <SelectItem value="bleeding">Bleeding</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>
      <Select value={initial.am ?? 'all'} onValueChange={(v) => update({ am: v })}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Account Manager" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any AM</SelectItem>
          <SelectItem value="none">No AM</SelectItem>
          {ams.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(initial.search || initial.brand || initial.status || initial.profit || initial.am) && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/clients')}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
      <DateRangeFilter basePath="/clients" />
    </div>
  );
}
