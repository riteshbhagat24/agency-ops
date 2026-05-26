'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COUNTRIES,
  INVOICE_TIMING_OPTIONS,
  createClientSchema,
  type CreateClientInput,
} from '@/lib/validations/clients';
import { createClient } from './actions';
import { AgreementUpload, type AgreementValue } from './agreement-upload';

type UserPick = { id: string; full_name: string; role: string };

export function NewClientForm({ users }: { users: UserPick[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scopeItems, setScopeItems] = useState<string[]>([]);
  const [scopeInput, setScopeInput] = useState('');
  const [agreement, setAgreement] = useState<AgreementValue | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      brand_code: 'FRM',
      billing_cycle: 'monthly',
      allowed_revisions: 2,
      status: 'active',
      country: 'IN',
      currency: 'INR',
      tax_rate: 18,
      payment_terms_days: 30,
    },
  });

  // When country changes, auto-fill currency + tax_rate to that country's defaults.
  function onCountryChange(code: string) {
    const country = COUNTRIES.find((c) => c.code === code);
    if (!country) return;
    setValue('country', country.code, { shouldValidate: true });
    setValue('currency', country.currency, { shouldValidate: true });
    setValue('tax_rate', country.defaultTax, { shouldValidate: true });
  }

  const currentTaxLabel = (() => {
    const c = watch('country');
    if (c === 'IN') return 'GST';
    if (c === 'US') return 'Sales Tax';
    return 'VAT';
  })();

  function addScope() {
    const v = scopeInput.trim();
    if (!v) return;
    setScopeItems((arr) => [...arr, v]);
    setScopeInput('');
  }

  function removeScope(idx: number) {
    setScopeItems((arr) => arr.filter((_, i) => i !== idx));
  }

  function onSubmit(values: CreateClientInput) {
    startTransition(async () => {
      const result = await createClient({
        ...values,
        scope_included: scopeItems,
        agreement_path: agreement?.path ?? null,
        agreement_filename: agreement?.filename ?? null,
        agreement_size: agreement?.size ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Client created');
      router.push(`/clients/${result.data.id}`);
    });
  }

  const brand = watch('brand_code') ?? 'FRM';
  const todayDDMMYY = (() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return `${dd}${mm}${yy}`;
  })();
  const codePreview = `${brand}${todayDDMMYY}/<n>`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand">
          <Select
            defaultValue="FRM"
            onValueChange={(v) =>
              setValue('brand_code', v as 'FRM' | 'OV', { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FRM">FRM — Futuready Media</SelectItem>
              <SelectItem value="OV">OV — Orange Videos</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Client code" hint={`Auto-generated: ${codePreview}`}>
          <Input value={codePreview} disabled readOnly className="font-mono" />
        </Field>
      </div>

      <Field label="Client name" error={errors.client_name?.message}>
        <Input placeholder="Tata Communications" {...register('client_name')} />
      </Field>

      <Field label="Billing name (on invoice)">
        <Input
          placeholder="Tata Communications Pvt. Ltd."
          {...register('billing_name')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Country">
          <Select defaultValue="IN" onValueChange={onCountryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Currency">
          <Input readOnly {...register('currency')} />
        </Field>
        <Field label={`${currentTaxLabel} %`}>
          <Input type="number" min={0} max={50} step={0.5} {...register('tax_rate')} />
        </Field>
        <Field label="Payment terms (days)">
          <Input type="number" min={0} max={180} {...register('payment_terms_days')} />
        </Field>
      </div>

      {watch('country') === 'IN' && (
        <Field label="GSTIN (optional)">
          <Input placeholder="29ABCDE1234F2Z5" {...register('gstin')} />
        </Field>
      )}

      <Field label="Invoice generation timing">
        <Select
          defaultValue="on_approval"
          onValueChange={(v) =>
            setValue('invoice_timing', v as CreateClientInput['invoice_timing'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_TIMING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="font-medium">{opt.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">· {opt.hint}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billing email">
          <Input type="email" placeholder="accounts@tata.com" {...register('billing_email')} />
        </Field>
        <Field label="Billing address">
          <Input placeholder="Mumbai, India" {...register('billing_address')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Retainer / mo (${watch('currency') ?? 'INR'})`}>
          <Input type="number" min={0} step={1000} {...register('retainer_amount')} />
        </Field>
        <Field label="Billing cycle">
          <Select
            defaultValue="monthly"
            onValueChange={(v) =>
              setValue('billing_cycle', v as 'monthly' | 'quarterly' | 'annual')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Allowed revisions / cycle">
          <Input type="number" min={0} max={20} {...register('allowed_revisions')} />
        </Field>
      </div>

      <Field label="Account manager">
        <Select
          onValueChange={(v) => setValue('account_manager_id', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose AM" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name} · {u.role.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Scope (what the retainer includes)
        </Label>
        <div className="flex gap-2">
          <Input
            value={scopeInput}
            onChange={(e) => setScopeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addScope();
              }
            }}
            placeholder="e.g. 10 reels/mo"
          />
          <Button type="button" variant="outline" onClick={addScope} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {scopeItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scopeItems.map((s, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeScope(idx)}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date">
          <Input type="date" {...register('start_date')} />
        </Field>
        <Field label="Status">
          <Select
            defaultValue="active"
            onValueChange={(v) =>
              setValue('status', v as 'active' | 'paused' | 'churned' | 'prospect')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <AgreementUpload value={agreement} onChange={setAgreement} pathPrefix="pending" />

      <Field label="Notes">
        <Textarea rows={3} {...register('notes')} placeholder="Internal context" />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create client'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
