'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { WaitlistModal } from '@/components/WaitlistModal';

// ─── Domino data ─────────────────────────────────────────────
const PAIRS: [number, number][] = [
  [3,5],[1,6],[4,2],[6,3],[2,5],[5,1],[3,4],[6,2],[4,6],[2,4]
];
const N = PAIRS.length;

const PIP_POS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function TileHalf({ value }: { value: number }) {
  const on = PIP_POS[value] ?? [];
  return (
    <div style={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gridTemplateRows: 'repeat(3,1fr)',
      padding: '16%',
      alignItems: 'center',
      justifyItems: 'center',
    }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{
          width: '72%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: on.includes(i + 1)
            ? 'radial-gradient(circle at 35% 35%, oklch(0.92 0.006 80), oklch(0.78 0.01 80))'
            : 'transparent',
          boxShadow: on.includes(i + 1)
            ? 'inset 0 1.5px 3px rgba(0,0,0,0.55), 0 0.5px 0 rgba(255,255,255,0.05)'
            : 'none',
          transition: 'none',
        }} />
      ))}
    </div>
  );
}

// ─── Main animation component ─────────────────────────────────
function DominoEffect() {
  const [fallen, setFallen] = useState<boolean[]>(Array(N).fill(false));
  const [isRising, setIsRising] = useState(false);
  const [hint, setHint] = useState(true);
  const running = useRef(false);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
  };

  const run = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setHint(false);
    clearTimers();

    const ts: ReturnType<typeof setTimeout>[] = [];

    // reset instantly (no transition)
    setIsRising(false);
    setFallen(Array(N).fill(false));

    // cascade fall — each tile delayed by 140ms
    for (let i = 0; i < N; i++) {
      ts.push(setTimeout(() => {
        setFallen(prev => { const n = [...prev]; n[i] = true; return n; });
      }, 80 + i * 140));
    }

    // pause after all fallen, then arm rise transition
    const riseAt = 80 + N * 140 + 800;
    ts.push(setTimeout(() => setIsRising(true), riseAt));
    // one frame later, clear fallen so tiles animate back up
    ts.push(setTimeout(() => setFallen(Array(N).fill(false)), riseAt + 16));
    // mark done after rise completes
    ts.push(setTimeout(() => {
      setIsRising(false);
      running.current = false;
    }, riseAt + 16 + 600));

    timerIds.current = ts;
  }, []);

  // auto-start then loop
  useEffect(() => {
    const CYCLE = 80 + N * 140 + 800 + 16 + 600 + 2000;
    const loopTs: ReturnType<typeof setTimeout>[] = [];

    const tick = () => {
      run();
      loopTs.push(setTimeout(tick, CYCLE));
    };
    loopTs.push(setTimeout(tick, 900));

    return () => {
      loopTs.forEach(clearTimeout);
      clearTimers();
    };
  }, [run]);

  return (
    <div
      onClick={() => { if (!running.current) run(); }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {/* stage */}
      <div style={{
        background: 'linear-gradient(165deg, #201A10, #171208, #120E08)',
        borderRadius: 22,
        padding: '32px 28px 36px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 9,
        perspective: '520px',
        perspectiveOrigin: '50% 0%',
        boxShadow:
          '0 24px 64px rgba(0,0,0,0.28), 0 6px 16px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* warm ambient light bleed */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 22,
          background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(237,71,21,0.07), transparent)',
        }} />

        {/* floor highlight */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
          background: 'linear-gradient(to top, rgba(255,255,255,0.025), transparent)',
          pointerEvents: 'none', borderRadius: '0 0 22px 22px',
        }} />

        {PAIRS.map(([top, bot], i) => {
          const isFallen = fallen[i];
          return (
            <div
              key={i}
              style={{
                width: 40,
                height: 80,
                flexShrink: 0,
                background: isFallen
                  ? 'linear-gradient(160deg, #252018, #1C1610)'
                  : 'linear-gradient(160deg, #302418, #261C10, #1E1608)',
                borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: isFallen
                  ? '0 1px 4px rgba(0,0,0,0.7)'
                  : [
                      '2px 8px 20px rgba(0,0,0,0.6)',
                      'inset 0 1px 0 rgba(255,255,255,0.10)',
                      'inset 1px 0 0 rgba(255,255,255,0.04)',
                      `-${i * 2}px 0 8px rgba(0,0,0,0.15)`,
                    ].join(', '),
                display: 'flex',
                flexDirection: 'column',
                transformOrigin: 'bottom center',
                transform: `rotateX(${isFallen ? 82 : 0}deg)`,
                transition: isFallen
                  ? 'transform 0.44s cubic-bezier(0.55, 0, 0.9, 0.4), box-shadow 0.44s ease'
                  : isRising
                    ? 'transform 0.52s cubic-bezier(0.175, 0.885, 0.32, 1.28), box-shadow 0.52s ease'
                    : 'none',
              }}
            >
              <TileHalf value={top} />
              <div style={{
                height: '1.5px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
                margin: '0 18%',
                flexShrink: 0,
              }} />
              <TileHalf value={bot} />
            </div>
          );
        })}
      </div>

      {/* hint */}
      <div style={{
        textAlign: 'center',
        marginTop: 11,
        fontSize: 11.5,
        color: 'var(--ink-4)',
        letterSpacing: '0.03em',
        opacity: hint ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
      }}>
        tap to play
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────
export default function DominoLandingPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

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
        <span className="font-compagnon text-xl font-bold tracking-wider text-foreground">
          domino<span className="text-primary">.</span>
        </span>
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

        {/* hero */}
        <div style={{ marginTop: 40, marginBottom: 36 }}>
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
            <button
              type="button"
              onClick={() => setShowWaitlist(true)}
              style={{
                height: 46, padding: '0 22px', borderRadius: 12,
                background: 'var(--domino-accent)', color: 'white',
                fontWeight: 700, fontSize: 15, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
                boxShadow: '0 4px 16px oklch(0.66 0.19 35 / 0.35)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px oklch(0.66 0.19 35 / 0.45)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.66 0.19 35 / 0.35)';
              }}
            >
              join the waitlist →
            </button>
            <Link
              href="/login"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', textDecoration: 'none', padding: '10px 4px' }}
            >
              already have access? login
            </Link>
          </div>
        </div>

        {/* domino effect */}
        <DominoEffect />

        {/* how it works */}
        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { step: '01', text: 'send any link, thought, or image to domino on whatsapp' },
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
