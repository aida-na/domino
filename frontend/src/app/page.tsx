'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { DominoHeroPoster } from '@/features/domino/domino-hero-poster';

export default function DominoLandingPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) localStorage.setItem('domino_invite_ref', ref.trim().toLowerCase());
    } catch {
      /* ignore */
    }
  }, []);

  // Show landing immediately — only hide once we know the user has a session.
  if (!isLoading && sessionToken) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--domino-accent)', borderTopColor: 'transparent' }}
        />
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh lowercase leading-snug overflow-x-clip"
      style={{ background: '#FBFAF8', color: '#1F1B18' }}
    >
      <DominoHeroPoster />
    </main>
  );
}
