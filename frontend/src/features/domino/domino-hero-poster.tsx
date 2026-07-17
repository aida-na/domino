'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

/** Which of the 9 pip-grid cells light up for a given domino face value (0-6). */
const PIP_CELLS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DominoHalf({ value, scale }: { value: number; scale: number }) {
  const cells = PIP_CELLS[value] ?? [];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        flex: 1,
        padding: `${8 * scale}px ${6 * scale}px`,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 7 * scale,
            height: 7 * scale,
            borderRadius: '50%',
            background: cells.includes(i) ? '#2A2320' : 'transparent',
            alignSelf: 'center',
            justifySelf: 'center',
          }}
        />
      ))}
    </div>
  );
}

function DominoTile({ top, bottom, scale }: { top: number; bottom: number; scale: number }) {
  return (
    <div
      style={{
        width: 50 * scale,
        height: 110 * scale,
        borderRadius: 11 * scale,
        background: '#F3E8CC',
        boxShadow: '0 30px 50px -10px rgba(50,15,0,.55)',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(0,0,0,.05)',
        flexShrink: 0,
      }}
    >
      <DominoHalf value={top} scale={scale} />
      <div style={{ height: 2 * scale, background: 'rgba(42,35,32,.22)', margin: `0 ${8 * scale}px` }} />
      <DominoHalf value={bottom} scale={scale} />
    </div>
  );
}

/** Face pairs for the row of oversized dominoes standing behind the headline. */
const BACKDROP_TILES: Array<[number, number]> = [
  [6, 2], [3, 5], [4, 4], [2, 6], [5, 1], [1, 3], [6, 5], [3, 2],
];

/** Backdrop dominoes topple over and reset every ~3.2s, echoing the brand's chain-fall motif. */
function ToppleBackdrop() {
  const [toppled, setToppled] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setToppled((t) => !t), 3200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 26, alignItems: 'flex-end' }}>
      {BACKDROP_TILES.map(([top, bottom], i) => (
        <div
          key={i}
          style={{
            transformOrigin: 'bottom left',
            transform: toppled ? 'rotate(-78deg) translateX(-8px)' : 'rotate(0deg)',
            transition: 'transform .7s cubic-bezier(.34,1.35,.64,1)',
            transitionDelay: `${(toppled ? i * 0.11 : (BACKDROP_TILES.length - 1 - i) * 0.06)}s`,
          }}
        >
          <DominoTile top={top} bottom={bottom} scale={2.15} />
        </div>
      ))}
    </div>
  );
}

/**
 * Immersive poster hero ("2a" from the landing exploration) — dominoes toppling as a
 * backdrop behind the headline, no explainer steps. Replaces the previous card-based hero.
 */
export function DominoHeroPoster() {
  return (
    <div
      className={bricolage.variable}
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: 'clamp(560px, 100dvh, 760px)',
        background: 'radial-gradient(130% 120% at 50% -10%, #D8722A 0%, #B4520F 55%, #7E360A 100%)',
      }}
    >
      {/* vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 120%, rgba(0,0,0,.55), transparent 60%)' }} />

      {/* background dominoes */}
      <div style={{ position: 'absolute', left: '50%', bottom: -26, transform: 'translateX(-50%)', zIndex: 0, opacity: 0.92 }}>
        <ToppleBackdrop />
      </div>

      {/* readability scrim */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(180deg, rgba(90,35,5,.42) 0%, rgba(90,35,5,.05) 34%, transparent 55%)',
        }}
      />

      {/* top bar */}
      <div
        style={{
          position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', paddingTop: 'max(20px, calc(env(safe-area-inset-top) + 16px))',
        }}
      >
        <Link
          href="/"
          className="dn-wordmark"
          style={{ fontSize: 24, color: '#FCF4E4', textDecoration: 'none' }}
        >
          domino<span style={{ color: '#FFD9B0' }}>.</span>
        </Link>
        <Link
          href="/login"
          style={{
            fontWeight: 700, fontSize: 13, color: '#7E360A', background: '#FCF4E4',
            padding: '9px 16px', borderRadius: 999, textDecoration: 'none',
          }}
        >
          login
        </Link>
      </div>

      {/* headline block */}
      <div style={{ position: 'relative', zIndex: 2, padding: '14px 20px 40px', maxWidth: 760 }}>
        <div
          style={{
            fontWeight: 700, fontSize: 'clamp(10px, 3vw, 13px)', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#FFCFA6', marginBottom: 18,
          }}
        >
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-bricolage), sans-serif', fontWeight: 800,
            fontSize: 'clamp(2.15rem, 8vw, 5.75rem)', lineHeight: 0.94, letterSpacing: '-0.03em',
            color: '#FCF4E4', margin: '0 0 20px', textShadow: '0 8px 30px rgba(60,20,0,.35)',
          }}
        >
          you save things you never revisit.
        </h1>
        <p style={{ fontSize: 'clamp(14px, 4vw, 20px)', lineHeight: 1.5, color: '#FBE9D5', maxWidth: 480, margin: '0 0 26px' }}>
          domino turns everything you capture into something that actually compounds — surfaced back the moment it matters.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              fontWeight: 700, fontSize: 16, color: '#7E360A', background: '#FCF4E4', padding: '15px 26px',
              borderRadius: 14, boxShadow: '0 18px 40px -12px rgba(0,0,0,.5)', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            get started →
          </Link>
        </div>
      </div>
    </div>
  );
}
