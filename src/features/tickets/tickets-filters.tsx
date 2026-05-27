'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/data/date-range-filter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const QUICK_FILTERS = [
  { key: 'pending_class', label: 'Awaiting classification', q: { status: 'pending_classification' } },
  { key: 'pending_mgmt', label: 'Pending mgmt approval', q: { approval: 'pending_management' } },
  { key: 'pending_client', label: 'Pending client approval', q: { approval: 'pending_client' } },
  { key: 'in_progress', label: 'In progress', q: { status: 'in_progress' } },
  { key: 'delivered', label: 'Delivered', q: { status: 'delivered' } },
];

interface ClientLite {
  id: string;
  client_name: string;
  brand_code: string;
}

interface UserLite {
  id: string;
  full_name: string;
}

interface TicketsFiltersProps {
  initial: {
    search?: string;
    status?: string;
    classification?: string;
    approvalStage?: string;
    client?: string;
    assignee?: string;
    brand?: string;
    due?: string;
  };
  clients?: ClientLite[];
  users?: UserLite[];
}

export function TicketsFilters({ initial, clients = [], users = [] }: TicketsFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete('page');
      startTransition(() => router.replace(`/tickets?${sp.toString()}`));
    },
    [params, router],
  );

  const hasActiveFilter =
    initial.search ||
    initial.status ||
    initial.classification ||
    initial.approvalStage ||
    initial.client ||
    initial.assignee ||
    initial.brand ||
    initial.due;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search ticket, client, job code…"
            defaultValue={initial.search ?? ''}
            className="pl-8"
            onChange={(e) => updateParam({ q: e.target.value || undefined })}
          />
        </div>

        <Select
          value={initial.classification ?? 'all'}
          onValueChange={(v) => updateParam({ classification: v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classifications</SelectItem>
            <SelectItem value="included">Included</SelectItem>
            <SelectItem value="extra_billable">Extra Billable</SelectItem>
            <SelectItem value="revision">Revision</SelectItem>
            <SelectItem value="out_of_scope">Out of Scope</SelectItem>
            <SelectItem value="goodwill">Goodwill</SelectItem>
          </SelectContent>
        </Select>

        <Select value={initial.status ?? 'all'} onValueChange={(v) => updateParam({ status: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_classification">Pending classification</SelectItem>
            <SelectItem value="waiting_approval">Waiting approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {clients.length > 0 && (
          <Select value={initial.client ?? 'all'} onValueChange={(v) => updateParam({ client: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.brand_code} · {c.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {users.length > 0 && (
          <Select
            value={initial.assignee ?? 'all'}
            onValueChange={(v) => updateParam({ assignee: v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="me">Just me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={initial.brand ?? 'all'} onValueChange={(v) => updateParam({ brand: v })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            <SelectItem value="FRM">Futuready Media</SelectItem>
            <SelectItem value="OV">Orange Videos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={initial.due ?? 'all'} onValueChange={(v) => updateParam({ due: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Due" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any time</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="no_due">No deadline</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace('/tickets')}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        {isPending && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              type="button"
              onClick={() => updateParam(qf.q)}
              className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {qf.label}
            </button>
          ))}
        </div>
        <DateRangeFilter basePath="/tickets" />
      </div>
    </div>
  );
}
