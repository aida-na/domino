'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bricolage_Grotesque, Gloock, Space_Grotesk } from 'next/font/google';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

const gloock = Gloock({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-gloock',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space-grotesk',
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
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const iv = setInterval(() => setToppled((t) => !t), 3200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 'clamp(10px, 2.5vw, 26px)', alignItems: 'flex-end' }}>
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
 * Immersive poster hero ("2a" from Claude Design) — dominoes toppling as a
 * backdrop behind the headline, no explainer steps.
 */
export function DominoHeroPoster() {
  return (
    <div
      className={`${bricolage.variable} ${gloock.variable} ${spaceGrotesk.variable}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        flex: '1 1 0%',
        minHeight: 0,
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
        background: 'radial-gradient(130% 120% at 50% -10%, #D8722A 0%, #B4520F 55%, #7E360A 100%)',
      }}
    >
      {/* vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 90% at 50% 120%, rgba(0,0,0,.55), transparent 60%)',
        }}
      />

      {/* background dominoes */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -26,
          transform: 'translateX(-50%)',
          zIndex: 0,
          opacity: 0.92,
          pointerEvents: 'none',
        }}
      >
        <ToppleBackdrop />
      </div>

      {/* floor line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 150,
          height: 1,
          background: 'rgba(0,0,0,.22)',
          zIndex: 0,
        }}
      />

      {/* readability scrim */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'linear-gradient(180deg, rgba(90,35,5,.42) 0%, rgba(90,35,5,.05) 34%, transparent 55%)',
        }}
      />

      {/* top bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(16px, 4vw, 32px) clamp(20px, 5vw, 44px)',
          paddingTop: 'max(20px, calc(env(safe-area-inset-top) + 16px))',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-gloock), serif',
            fontSize: 'clamp(22px, 4vw, 30px)',
            color: '#FCF4E4',
            letterSpacing: '-0.01em',
            textDecoration: 'none',
          }}
        >
          domino<span style={{ color: '#FFD9B0' }}>.</span>
        </Link>
        <Link
          href="/login"
          className="touch-manipulation"
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: '#7E360A',
            background: '#FCF4E4',
            padding: '10px 18px',
            borderRadius: 999,
            textDecoration: 'none',
          }}
        >
          login
        </Link>
      </div>

      {/* headline block */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'clamp(12px, 3vw, 22px) clamp(20px, 5vw, 44px) 48px',
          maxWidth: 760,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 'clamp(10px, 3vw, 13px)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#FFCFA6',
            marginBottom: 'clamp(14px, 3vw, 22px)',
          }}
        >
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-bricolage), sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(2.15rem, 8vw, 5.75rem)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: '#FCF4E4',
            margin: '0 0 clamp(18px, 3vw, 26px)',
            textShadow: '0 8px 30px rgba(60,20,0,.35)',
            textWrap: 'balance',
          }}
        >
          you save things you never revisit.
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 3.8vw, 20px)',
            lineHeight: 1.5,
            color: '#FBE9D5',
            maxWidth: 500,
            margin: '0 0 clamp(24px, 4vw, 34px)',
          }}
        >
          domino turns everything you capture into something that actually compounds — surfaced back
          the moment it matters.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <Link
            href="/login"
            className="touch-manipulation"
            style={{
              fontWeight: 700,
              fontSize: 'clamp(15px, 3.5vw, 18px)',
              color: '#7E360A',
              background: '#FCF4E4',
              padding: '17px 32px',
              borderRadius: 14,
              boxShadow: '0 18px 40px -12px rgba(0,0,0,.5)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            get started →
          </Link>
          <span style={{ fontSize: 15, color: '#FFD9B0' }}>free while in beta</span>
        </div>
      </div>
    </div>
  );
}
