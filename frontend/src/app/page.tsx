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
      <main className="min-h-screen flex items-center justify-center bg-background bg-check-grid">
        <span className="w-5 h-5 rounded-full border-2 border-[#ED4715] border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background bg-check-grid text-[#1A1208] font-figtree lowercase overflow-x-hidden leading-snug relative flex flex-col">

      <DominoHeroPoster />

      <footer className="shrink-0 flex flex-col gap-2 px-4 py-3 border-t border-border/50 md:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">© 2026 daily labs</span>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">faq</Link>
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">privacy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
