import { z } from 'zod';

export const updateInvoiceSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).optional().nullable(),
  due_at: z.string().optional().nullable(),
  subtotal_override: z.coerce.number().min(0).optional().nullable(),
  tax_rate_override: z.coerce.number().min(0).max(50).optional().nullable(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const addInvoiceLineItemSchema = z.object({
  invoice_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  amount: z.coerce.number().min(0),
});

export type AddInvoiceLineItemInput = z.infer<typeof addInvoiceLineItemSchema>;
