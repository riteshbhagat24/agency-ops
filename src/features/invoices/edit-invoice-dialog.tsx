'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateInvoice, addInvoiceLineItem } from './actions';

interface EditInvoiceDialogProps {
  id: string;
  subtotal: number;
  taxRate: number;
  notes: string | null;
  dueAt: string | null;
  currency: string;
}

export function EditInvoiceDialog({
  id,
  subtotal,
  taxRate,
  notes,
  dueAt,
  currency,
}: EditInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    notes: notes ?? '',
    due_at: dueAt ? dueAt.slice(0, 10) : '',
    subtotal_override: String(subtotal),
    tax_rate_override: String(taxRate),
  });
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await updateInvoice({
        id,
        notes: form.notes || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        subtotal_override:
          form.subtotal_override === '' ? null : Number(form.subtotal_override),
        tax_rate_override:
          form.tax_rate_override === '' ? null : Number(form.tax_rate_override),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Invoice updated');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit invoice</DialogTitle>
          <DialogDescription>
            Override the subtotal, tax rate, due date, or notes. Totals are recomputed
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Subtotal ({currency})
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.subtotal_override}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtotal_override: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tax rate (%)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.tax_rate_override}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tax_rate_override: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Due date
            </Label>
            <Input
              type="date"
              value={form.due_at}
              onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes (printed on the invoice)
            </Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Thanks for your business. Payment via NEFT to…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddLineItemDialog({
  invoiceId,
  currency,
}: {
  invoiceId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!title.trim() || !amount || Number(amount) <= 0) {
      toast.error('Title and a positive amount are required');
      return;
    }
    startTransition(async () => {
      const r = await addInvoiceLineItem({
        invoice_id: invoiceId,
        title: title.trim(),
        amount: Number(amount),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Line item added');
      setOpen(false);
      setTitle('');
      setAmount('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add line item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add manual line item</DialogTitle>
          <DialogDescription>
            For charges that aren't tied to a ticket — e.g. setup fee, platform charge,
            late fee.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Input
              placeholder="Annual platform fee"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount ({currency})
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add line item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
