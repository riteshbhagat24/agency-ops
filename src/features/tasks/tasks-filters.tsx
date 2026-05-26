'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ClientLite {
  id: string;
  client_name: string;
  brand_code: string;
}

interface UserLite {
  id: string;
  full_name: string;
}

interface TasksFiltersProps {
  initial: { search?: string; status?: string; client?: string; assignee?: string; due?: string };
  clients: ClientLite[];
  users: UserLite[];
}

export function TasksFilters({ initial, clients, users }: TasksFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`/tasks?${sp.toString()}`);
    },
    [params, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search task or ticket…"
          defaultValue={initial.search ?? ''}
          className="pl-8"
          onChange={(e) => update({ q: e.target.value || undefined })}
        />
      </div>
      <Select value={initial.status ?? 'all'} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="waiting_approval">Waiting approval</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="on_hold">On hold</SelectItem>
        </SelectContent>
      </Select>

      <Select value={initial.client ?? 'all'} onValueChange={(v) => update({ client: v })}>
        <SelectTrigger className="w-[200px]">
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

      <Select value={initial.assignee ?? 'all'} onValueChange={(v) => update({ assignee: v })}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everyone</SelectItem>
          <SelectItem value="me">Just me</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={initial.due ?? 'all'} onValueChange={(v) => update({ due: v })}>
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

      {(initial.search || initial.status || initial.client || initial.assignee || initial.due) && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/tasks')}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
