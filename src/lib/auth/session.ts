import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User, UserRole } from '@/types/database.types';

export type SessionUser = User & { email_verified?: boolean };

/**
 * Returns the signed-in user's profile row (joining auth.users → public.users).
 * Throws-by-redirect to /login if there is no session.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect('/login');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (error || !data) {
    // Profile row missing — handle_new_user trigger should have created it.
    // Send to login and let auth recover.
    redirect('/login?error=missing_profile');
  }
  return data as SessionUser;
}

/** Soft variant used in places where unauth is fine (e.g. /login). */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  return (data as SessionUser) ?? null;
}

export async function requireRole(...allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect('/dashboard?error=forbidden');
  }
  return user;
}
