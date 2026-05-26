import { requireUser } from '@/lib/auth/session';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { CommandPaletteProvider } from '@/components/shell/command-palette';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Toaster } from '@/components/ui/toaster';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .eq('user_id', user.id);

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-dvh w-full">
        <Sidebar role={user.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} unreadCount={count ?? 0} />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
      <Toaster />
    </CommandPaletteProvider>
  );
}
