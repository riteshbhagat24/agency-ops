'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function GoogleSignInButton({ next }: { next?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectUrl = new URL('/auth/callback', window.location.origin);
    if (next) redirectUrl.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      console.error('OAuth sign-in failed', error);
      setIsLoading(false);
      window.location.href = '/login?error=oauth_failed';
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      onClick={handleSignIn}
      disabled={isLoading}
    >
      <GoogleLogo className="h-4 w-4" />
      {isLoading ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.84h5.36c-.24 1.4-1.66 4.1-5.36 4.1-3.23 0-5.86-2.67-5.86-5.96S8.77 6.22 12 6.22c1.84 0 3.07.78 3.78 1.45l2.58-2.5C16.78 3.7 14.6 2.8 12 2.8 6.96 2.8 2.9 6.86 2.9 11.9S6.96 21 12 21c6.93 0 9.1-4.84 9.1-7.36 0-.5-.05-.88-.12-1.26H12z"
      />
    </svg>
  );
}
