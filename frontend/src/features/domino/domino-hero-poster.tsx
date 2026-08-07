'use client';

import Link from 'next/link';
import { DominoLandingMockups } from '@/features/domino/domino-landing-mockups';

const FEATURES = [
  {
    activeTile: 0 as const,
    title: 'send it, domino sorts it',
    body: 'send an imessage with a link or a half-formed thought at 1am. domino files it and groups it with the rest.',
  },
  {
    activeTile: 1 as const,
    title: 'it surfaces your taste',
    body: "save enough and a shape appears. domino pulls in links from people circling the same ideas — the stuff you'd never have found on your own.",
  },
  {
    activeTile: 2 as const,
    title: 'it finds you back',
    body: "ask for 'camping spots near sf?' and the links you saved months ago come back. plus a weekly digest of what's worth a second look.",
  },
] as const;

function TileChain({ active }: { active: 0 | 1 | 2 }) {
  return (
    <div className="flex items-end gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 24,
            borderRadius: 3,
            background: i === active ? 'var(--domino-accent)' : 'var(--bg-deep)',
            border: '1px solid var(--hairline-soft)',
            opacity: i === active ? 1 : 0.85,
          }}
        />
      ))}
    </div>
  );
}

function GetStartedButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`touch-manipulation inline-flex items-center justify-center rounded-full px-8 py-3.5 text-[15px] font-semibold no-underline transition-opacity hover:opacity-90 ${className}`}
      style={{ color: '#fff', background: 'var(--domino-accent)' }}
    >
      get started
    </Link>
  );
}

/** Landing page — centered editorial layout with app mockups. */
export function DominoHeroPoster() {
  return (
    <div className="flex flex-col" style={{ background: 'var(--bg)' }}>
      <header
        className="flex shrink-0 items-center justify-between px-5 py-4 md:px-8"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <Link href="/" className="dn-wordmark text-[clamp(22px,4vw,28px)] no-underline" style={{ color: 'var(--ink)' }}>
          domino<span style={{ color: 'var(--domino-accent)' }}>.</span>
        </Link>
        <Link
          href="/login"
          className="touch-manipulation rounded-full px-4 py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-80"
          style={{
            color: 'var(--ink)',
            background: 'var(--paper)',
            border: '1px solid var(--hairline-soft)',
          }}
        >
          login
        </Link>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 pt-4 text-center md:px-8 md:pt-8">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5.5vw, 3.25rem)',
            lineHeight: 1.06,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
            margin: '0 0 14px',
            textWrap: 'balance',
          }}
        >
          the things you save, when you actually need them
          <span style={{ color: 'var(--domino-accent)' }}>.</span>
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 2.5vw, 17px)',
            lineHeight: 1.55,
            color: 'var(--ink-3)',
            margin: '0 auto 28px',
            maxWidth: 420,
          }}
        >
          domino helps you never lose what you find.
        </p>
        <GetStartedButton />
      </section>

      <section className="mx-auto w-full max-w-5xl px-2 py-10 md:py-14">
        <DominoLandingMockups />
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16 md:px-8 md:pb-24">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {FEATURES.map(({ activeTile, title, body }) => (
            <div key={title} className="flex flex-col gap-3">
              <TileChain active={activeTile} />
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  fontSize: 'clamp(1.125rem, 2.5vw, 1.35rem)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.015em',
                  color: 'var(--ink)',
                  margin: 0,
                }}
              >
                {title}
              </h2>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--ink-3)',
                  margin: 0,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-4xl px-6 py-16 text-center md:px-8 md:py-20"
        style={{ borderTop: '1px solid var(--hairline-soft)' }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(1.75rem, 4.5vw, 2.5rem)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            margin: '0 0 24px',
            textWrap: 'balance',
          }}
        >
          start a pile worth keeping
        </h2>
        <GetStartedButton />
      </section>
    </div>
  );
}
