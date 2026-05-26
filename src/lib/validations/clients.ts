import { z } from 'zod';

export const COUNTRIES = [
  { code: 'IN', name: 'India',          currency: 'INR', defaultTax: 18 },
  { code: 'US', name: 'United States',  currency: 'USD', defaultTax: 0 },
  { code: 'AE', name: 'UAE',            currency: 'AED', defaultTax: 5 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', defaultTax: 20 },
  { code: 'SG', name: 'Singapore',      currency: 'SGD', defaultTax: 9 },
  { code: 'AU', name: 'Australia',      currency: 'AUD', defaultTax: 10 },
] as const;

export const createClientSchema = z.object({
  // Server auto-generates client_code as BRAND+DDMMYY/N.
  // Optional override for imports; the UI form does not collect it.
  client_code: z
    .string()
    .max(40)
    .regex(/^[A-Z0-9/]+$/, 'UPPERCASE letters, digits, and / only')
    .optional()
    .nullable(),
  client_name: z.string().min(2).max(160),
  brand_code: z.enum(['FRM', 'OV']),
  brand_name: z.string().min(2).max(120).optional(),
  retainer_amount: z.coerce.number().min(0),
  billing_cycle: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
  scope_included: z.array(z.string()).default([]),
  allowed_revisions: z.coerce.number().int().min(0).max(20).default(2),
  account_manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'paused', 'churned', 'prospect']).default('active'),
  start_date: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),

  // Production fields
  country: z.enum(['IN', 'US', 'AE', 'GB', 'SG', 'AU']).default('IN'),
  currency: z.enum(['INR', 'USD', 'AED', 'GBP', 'SGD', 'AUD']).default('INR'),
  tax_rate: z.coerce.number().min(0).max(50).default(18),
  gstin: z.string().max(20).optional().nullable(),
  billing_name: z.string().max(200).optional().nullable(),
  billing_email: z.string().email().optional().nullable().or(z.literal('')),
  billing_address: z.string().max(500).optional().nullable(),
  payment_terms_days: z.coerce.number().int().min(0).max(180).default(30),

  // When to raise the invoice (drives the auto-invoice triggers)
  invoice_timing: z
    .enum(['advance_100', 'advance_50_50', 'on_approval', 'on_delivery'])
    .default('on_approval'),

  // Optional signed agreement / SOW (uploaded to Supabase Storage first,
  // we persist just the path + display name)
  agreement_path: z.string().max(500).optional().nullable(),
  agreement_filename: z.string().max(255).optional().nullable(),
  agreement_size: z.coerce.number().int().min(0).optional().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const INVOICE_TIMING_OPTIONS = [
  {
    value: 'advance_100',
    label: '100% Advance',
    hint: 'Single invoice raised on approval. Full amount due before work starts.',
  },
  {
    value: 'advance_50_50',
    label: '50% Advance · 50% Post',
    hint: 'Half invoice on approval, half after delivery.',
  },
  {
    value: 'on_approval',
    label: 'On Approval',
    hint: 'Standard: invoice raised when client approves the work.',
  },
  {
    value: 'on_delivery',
    label: 'Post Service',
    hint: 'Invoice only after work is delivered.',
  },
] as const;
