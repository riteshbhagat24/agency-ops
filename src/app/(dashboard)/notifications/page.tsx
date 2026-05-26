import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Stuff that needs your attention.</p>
      </header>

      <Card>
        <CardContent className="p-0">
          {!notifications || notifications.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex flex-col gap-1 px-5 py-3',
                    !n.read_at && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    {n.entity_type === 'ticket' && n.entity_id ? (
                      <Link
                        href={`/tickets/${n.entity_id}` as never}
                        className="font-medium hover:underline"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
