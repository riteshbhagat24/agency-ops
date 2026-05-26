'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { UserWithRelations } from './queries';
import { assignClient, unassignClient } from './actions';

type ClientLite = { id: string; client_code: string; client_name: string; brand_code: string };

export function ClientAssignmentsDialog({
  user,
  clients,
  open,
  onOpenChange,
}: {
  user: UserWithRelations;
  clients: ClientLite[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [pickedClient, setPickedClient] = useState<string | null>(null);
  const [pickedPrimary, setPickedPrimary] = useState(false);
  const [isPending, startTransition] = useTransition();

  const assignedIds = useMemo(
    () => new Set(user.assignments.map((a) => a.client_id)),
    [user.assignments],
  );
  const available = clients.filter((c) => !assignedIds.has(c.id));

  function add() {
    if (!pickedClient) return;
    startTransition(async () => {
      const r = await assignClient({
        user_id: user.id,
        client_id: pickedClient,
        is_primary: pickedPrimary,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Client assigned');
      setPickedClient(null);
      setPickedPrimary(false);
    });
  }

  function remove(client_id: string) {
    startTransition(async () => {
      const r = await unassignClient(user.id, client_id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Removed');
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{user.full_name} — Client assignments</DialogTitle>
          <DialogDescription>
            Controls which clients this user can see in filtered views. The Account Manager on a
            client is set separately on each client's detail page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border">
            {user.assignments.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Not assigned to any clients yet.
              </div>
            ) : (
              <ul className="divide-y">
                {user.assignments.map((a) => (
                  <li
                    key={a.client_id}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <Badge variant="muted" className="font-mono">
                      {a.client?.brand_code}·{a.client?.client_code}
                    </Badge>
                    <span className="flex-1">{a.client?.client_name}</span>
                    {a.is_primary && (
                      <Badge variant="warning" className="gap-1">
                        <Star className="h-3 w-3" /> Primary
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      onClick={() => remove(a.client_id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {available.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Assign a new client
              </div>
              <div className="flex items-center gap-2">
                <Select value={pickedClient ?? ''} onValueChange={setPickedClient}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.brand_code} · {c.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setPickedPrimary((v) => !v)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                    pickedPrimary
                      ? 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/30'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                  title="Mark as primary"
                >
                  <Star className="h-4 w-4" />
                </button>
                <Button onClick={add} disabled={!pickedClient || isPending}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
