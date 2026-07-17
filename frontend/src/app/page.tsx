'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { DominoLogo } from '@/features/domino/domino-logo';
import { DominoBrandHero } from '@/features/domino/domino-brand-hero';
import { WaitlistModal } from '@/components/WaitlistModal';

export default function DominoLandingPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const [showWaitlist, setShowWaitlist] = useState(false);

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

      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <DominoLogo size="md" />
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-1"
          >
            login
          </Link>
          <button
            type="button"
            onClick={() => setShowWaitlist(true)}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -ml-1"
          >
            waitlist
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px 60px', flex: 1, position: 'relative', zIndex: 1 }}>

        {/* brand mark */}
        <div style={{ marginTop: 28, marginBottom: 28 }}>
          <DominoBrandHero priority />
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <DominoLogo size="lg" showMark={false} className="justify-center" />
          </div>
        </div>

        {/* hero */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 42px)',
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 14,
            color: '#1A1208',
          }}>
            you save things you never revisit.
          </h1>
          <p style={{
            fontSize: 'clamp(15px, 3.8vw, 18px)',
            color: 'var(--ink-2)',
            lineHeight: 1.55,
            margin: '0 0 24px',
            fontWeight: 400,
          }}>
            domino turns everything you capture into something that actually compounds — indexed, summarised, and surfaced back when it matters.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              href="/login"
              style={{
                height: 46, padding: '0 22px', borderRadius: 12,
                background: 'var(--domino-accent)', color: 'white',
                fontWeight: 700, fontSize: 15, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
                boxShadow: '0 4px 16px oklch(0.66 0.19 35 / 0.35)',
                display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
              }}
            >
              get started →
            </Link>
            <button
              type="button"
              onClick={() => setShowWaitlist(true)}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', background: 'none', border: 0, cursor: 'pointer', padding: '10px 4px', fontFamily: 'inherit' }}
            >
              full today? join waitlist
            </button>
          </div>
        </div>

        {/* how it works */}
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { step: '01', text: 'send any link, thought, or image to domino over iMessage' },
            { step: '02', text: 'we extract the full text and summarise the key ideas with ai' },
            { step: '03', text: 'search, browse, and chat with everything you\'ve ever saved' },
            { step: '04', text: 'weekly digest resurfaces your best saves at the right moment' },
          ].map(({ step, text }) => (
            <div key={step} style={{
              background: 'var(--paper)',
              border: '1px solid var(--hairline)',
              borderRadius: 16,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--domino-accent)', marginBottom: 6 }}>
                step {step}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: 'var(--ink-2)' }}>
                {text}
              </div>
            </div>
          ))}
        </div>

      </div>

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

      <AnimatePresence>
        {showWaitlist && (
          <WaitlistModal key="waitlist" onClose={() => setShowWaitlist(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
