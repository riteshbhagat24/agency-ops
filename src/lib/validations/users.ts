import { z } from 'zod';

export const USER_ROLES = [
  'super_admin',
  'management',
  'accounts',
  'client_servicing',
  'operations',
  'video_team',
  'design_team',
] as const;

export const inviteUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .max(200)
    .transform((v) => v.trim().toLowerCase()),
  full_name: z.string().min(2, 'Name is too short').max(120),
  role: z.enum(USER_ROLES),
  department_id: z.string().uuid().optional().nullable(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(USER_ROLES),
});

export const updateUserDepartmentSchema = z.object({
  user_id: z.string().uuid(),
  department_id: z.string().uuid().nullable(),
});

export const setUserActiveSchema = z.object({
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});

export const assignClientSchema = z.object({
  user_id: z.string().uuid(),
  client_id: z.string().uuid(),
  is_primary: z.boolean().optional().default(false),
});

export const setClientAccountManagerSchema = z.object({
  client_id: z.string().uuid(),
  account_manager_id: z.string().uuid().nullable(),
});
