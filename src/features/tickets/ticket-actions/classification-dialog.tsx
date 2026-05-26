'use client';

import { useState, useTransition } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ClassificationChip, CLASSIFICATION_OPTIONS } from '@/components/data/classification-chip';
import { cn } from '@/lib/utils';
import type { Classification } from '@/types/database.types';
import { classifyTicket } from '@/features/tickets/actions';

export function ClassificationDialog({
  ticketId,
  current,
}: {
  ticketId: string;
  current: Classification | null;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Classification>(current ?? 'included');
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await classifyTicket(ticketId, { classification: picked, comment });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Classification updated');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          {current ? 'Change classification' : 'Classify ticket'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change classification</DialogTitle>
          <DialogDescription>
            This decides whether the ticket bills, requires approvals, or runs free.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {CLASSIFICATION_OPTIONS.map((opt) => {
            const selected = picked === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPicked(opt.value)}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-2.5 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-accent/40',
                )}
              >
                <ClassificationChip value={opt.value} />
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Comment (optional)
          </Label>
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why this classification?"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
