'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDominoAuth } from './domino-auth-context';

export function DominoProtectedRoute({ children }: { children: React.ReactNode }) {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const [hadTokenInUrl] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!new URLSearchParams(window.location.search).get('token'),
  );

  useEffect(() => {
    if (isLoading) return;
    if (sessionToken) return;
    if (hadTokenInUrl) return;
    router.replace('/');
  }, [isLoading, sessionToken, router, hadTokenInUrl]);

  if (isLoading || (!sessionToken && hadTokenInUrl)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background bg-check-grid">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sessionToken) return null;

  return <>{children}</>;
}
