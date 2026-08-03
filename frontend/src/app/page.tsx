'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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

  if (isLoading) {
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
      className="h-dvh lowercase overflow-hidden leading-snug relative flex flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <DominoHeroPoster />

      <footer
        className="shrink-0 flex flex-col gap-2 px-4 py-3 md:px-6"
        style={{
          background: 'var(--bg)',
          borderTop: '1px solid var(--hairline-soft)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
            © 2026 daily labs
          </span>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--ink-4)' }}>
              faq
            </Link>
            <Link href="/privacy" className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--ink-4)' }}>
              privacy
            </Link>
            <Link href="/terms" className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--ink-4)' }}>
              terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
