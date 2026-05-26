'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClassificationChip, CLASSIFICATION_OPTIONS } from '@/components/data/classification-chip';
import { cn } from '@/lib/utils';
import {
  REQUEST_TYPES,
  type CreateTicketInput,
  createTicketSchema,
} from '@/lib/validations/tickets';
import { createTicket } from './actions';

type ClientPick = { id: string; client_name: string; client_code: string; brand_code: string };

export function NewTicketForm({ clients }: { clients: ClientPick[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      priority: 'medium',
      classification: 'included',
      request_type: 'reel',
    },
  });

  const classification = watch('classification');
  const showApprovalHint =
    classification === 'extra_billable' ||
    classification === 'goodwill' ||
    classification === 'out_of_scope';

  function onSubmit(values: CreateTicketInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createTicket(values);
      if (!result.ok) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('Ticket created');
      router.push(`/tickets/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" error={errors.client_id?.message}>
          <Select onValueChange={(v) => setValue('client_id', v, { shouldValidate: true })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.brand_code} · {c.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority" error={errors.priority?.message}>
          <Select
            defaultValue="medium"
            onValueChange={(v) => setValue('priority', v as CreateTicketInput['priority'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Title" error={errors.title?.message}>
        <Input placeholder="e.g. 3 extra reels for Q2 push" {...register('title')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Request type" error={errors.request_type?.message}>
          <Select
            defaultValue="reel"
            onValueChange={(v) =>
              setValue('request_type', v as CreateTicketInput['request_type'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {rt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigned team">
          <Select
            onValueChange={(v) =>
              setValue('assigned_team', v as CreateTicketInput['assigned_team'])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video_team">Video Team</SelectItem>
              <SelectItem value="design_team">Design Team</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="client_servicing">Client Servicing</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          rows={4}
          placeholder="What is the client asking for? Any constraints, references, or due-date drivers?"
          {...register('description')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Deadline">
          <Input type="date" {...register('deadline')} />
        </Field>
        <Field label="Estimated hours">
          <Input type="number" min={0} step={0.5} placeholder="e.g. 8" {...register('estimated_hours')} />
        </Field>
        <Field label="Estimated amount (₹)">
          <Input type="number" min={0} step={500} placeholder="e.g. 18000" {...register('estimated_amount')} />
        </Field>
      </div>

      <fieldset className="rounded-lg border bg-card/40 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Commercial classification (mandatory)
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CLASSIFICATION_OPTIONS.map((opt) => {
            const selected = classification === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-accent/40',
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="mt-1"
                  checked={selected}
                  onChange={() =>
                    setValue('classification', opt.value, { shouldValidate: true })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ClassificationChip value={opt.value} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{opt.hint}</p>
                </div>
              </label>
            );
          })}
        </div>

        {showApprovalHint && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 h-3.5 w-3.5" />
            <span>
              This classification requires management approval before work begins.
              {classification === 'extra_billable' && ' Client approval is also required.'}
            </span>
          </div>
        )}
      </fieldset>

      {serverError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {serverError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create ticket'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
