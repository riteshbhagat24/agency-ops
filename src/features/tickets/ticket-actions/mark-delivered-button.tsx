'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
import { markTicketDelivered } from '@/features/tickets/actions';

export function MarkDeliveredButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDeliver() {
    startTransition(async () => {
      const r = await markTicketDelivered(ticketId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Marked as delivered. Invoice is finalized.');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Delivered
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark this ticket as delivered?</DialogTitle>
          <DialogDescription>
            This is the final state. The invoice (if any) becomes finalized.
            Time logs and billables are locked. Use this only when the work
            has been delivered to the client.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onDeliver} disabled={isPending}>
            {isPending ? 'Saving…' : 'Mark Delivered'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
