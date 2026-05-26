'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteClient } from './actions';

export function DeleteClientButton({
  clientId,
  clientName,
  clientCode,
}: {
  clientId: string;
  clientName: string;
  clientCode: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const r = await deleteClient(clientId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${clientName} deleted. Code ${clientCode} is now free for reuse.`);
      setOpen(false);
      router.push('/clients');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-rose-600">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {clientName}?</DialogTitle>
          <DialogDescription>
            This soft-deletes the client. Their tickets, tasks, and invoices stay in the audit log
            but the client disappears from active lists. The code{' '}
            <span className="font-mono font-medium text-foreground">{clientCode}</span> becomes
            available for the next client created today.
            <br />
            <br />
            You can restore the client from the Users / admin page within 30 days.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Type the client code to confirm
          </Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={clientCode}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isPending || confirm !== clientCode}
          >
            {isPending ? 'Deleting…' : 'Delete client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
