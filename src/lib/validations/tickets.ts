import { z } from 'zod';

export const CLASSIFICATIONS = [
  'included',
  'extra_billable',
  'revision',
  'out_of_scope',
  'goodwill',
] as const;

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const REQUEST_TYPES = [
  'reel',
  'reel-long',
  'post',
  'story',
  'video',
  'edit',
  'campaign',
  'shoot',
  'strategy',
  'design',
  'other',
] as const;

export const ASSIGNED_TEAMS = [
  'video_team',
  'design_team',
  'operations',
  'client_servicing',
] as const;

export const createTicketSchema = z.object({
  client_id: z.string().uuid({ message: 'Pick a client' }),
  title: z.string().min(3, 'Title is too short').max(200),
  description: z.string().max(4000).optional(),
  request_type: z.enum(REQUEST_TYPES),
  classification: z.enum(CLASSIFICATIONS),
  priority: z.enum(PRIORITIES).default('medium'),
  deadline: z.string().optional().nullable(),
  estimated_hours: z.coerce.number().min(0).max(2000).optional().nullable(),
  estimated_amount: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  assigned_team: z.enum(ASSIGNED_TEAMS).optional().nullable(),
  parent_ticket_id: z.string().uuid().optional().nullable(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const classifyTicketSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  comment: z.string().max(2000).optional(),
});

export const recordClientApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  actor_label: z.string().min(3).max(200),
  comment: z.string().max(2000).optional(),
});

export const managementApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional(),
});
