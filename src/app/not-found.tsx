import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Nothing here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist, was deleted, or you don't have permission to
          see it.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={'/dashboard' as never}>Back to dashboard</Link>
          </Button>
          <Button asChild>
            <Link href={'/tickets' as never}>See tickets</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
