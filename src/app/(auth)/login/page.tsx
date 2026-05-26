import { Sparkles } from 'lucide-react';
import { GoogleSignInButton } from '@/app/(auth)/login/google-button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const errorMessage = errorToMessage(sp.error);

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Agency Ops</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Commercial OS
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your agency Google account to continue.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-5">
            <GoogleSignInButton next={sp.next} />
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Restricted to{' '}
            <span className="font-medium text-foreground">@futuready.com</span> and{' '}
            <span className="font-medium text-foreground">@orangevideos.com</span> domains.
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          v0.1 · Phase 1
        </p>
      </div>
    </main>
  );
}

function errorToMessage(code?: string) {
  switch (code) {
    case 'unauthorized_domain':
      return 'Your email domain is not authorized to use this system.';
    case 'missing_profile':
      return 'Profile not provisioned. Contact the administrator.';
    case 'oauth_failed':
      return 'OAuth sign-in failed. Try again.';
    default:
      return null;
  }
}
