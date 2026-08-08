'use client';

import Link from 'next/link';
import { DominoLandingMockups, DominoLandingPhonePairs } from '@/features/domino/domino-landing-mockups';

const LANDING = {
  bg: '#FBFAF8',
  ink: '#1F1B18',
  accent: '#E8622C',
  muted: '#6B625A',
  footer: '#8C8177',
  border: '#EDE6DD',
  loginBg: 'rgba(232,98,44,0.07)',
  tileInactive: '#EDE7DD',
} as const;

const FEATURES = [
  {
    variant: 'saved' as const,
    activeTile: 0 as const,
    title: 'send it, domino sorts it',
    body: 'send an imessage with a link or a half-formed thought at 1am. domino files it and groups it with the rest.',
  },
  {
    variant: 'map' as const,
    activeTile: 1 as const,
    title: 'it surfaces your taste',
    body: "save enough and a shape appears. domino pulls in links from people circling the same ideas — the stuff you'd never have found on your own.",
  },
  {
    variant: 'ask' as const,
    activeTile: 2 as const,
    title: 'it finds you back',
    body: 'ask for “camping spots near sf?” and the links you saved months ago come back. plus a weekly digest of what\'s worth a second look.',
  },
] as const;

function TileChain({ active }: { active: 0 | 1 | 2 }) {
  return (
    <div className="flex gap-[5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 32,
            height: 20,
            borderRadius: 5,
            background: i === active ? LANDING.accent : LANDING.tileInactive,
            display: 'block',
          }}
        />
      ))}
    </div>
  );
}

function FeatureCopy({
  activeTile,
  title,
  body,
}: {
  activeTile: 0 | 1 | 2;
  title: string;
  body: string;
}) {
  return (
    <>
      <TileChain active={activeTile} />
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(18px, 4.5vw, 21px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: LANDING.ink,
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 'clamp(15px, 3.8vw, 16px)', lineHeight: 1.55, color: LANDING.muted, margin: 0 }}>{body}</p>
    </>
  );
}

function GetStartedButton({ className = '', fullWidth = false }: { className?: string; fullWidth?: boolean }) {
  return (
    <Link
      href="/login"
      className={`touch-manipulation inline-flex items-center justify-center rounded-full no-underline transition-opacity hover:opacity-90 active:opacity-80 ${fullWidth ? 'w-full max-w-xs' : ''} ${className}`}
      style={{
        background: LANDING.accent,
        color: '#fff',
        padding: fullWidth ? '16px 32px' : '19px 46px',
        fontSize: 17,
        fontWeight: 600,
        boxShadow: '0 10px 26px rgba(232,98,44,0.28)',
      }}
    >
      get started
    </Link>
  );
}

/** Landing page — matches Domino Landing.dc.html reference layout. */
export function DominoHeroPoster() {
  return (
    <div
      className="mx-auto w-full max-w-[1440px] lowercase"
      style={{ background: LANDING.bg, color: LANDING.ink, fontFamily: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif' }}
    >
      <div
        className="flex items-center justify-between px-5 py-5 md:px-14 md:py-[26px]"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
      >
        <Link href="/" className="dn-wordmark no-underline" style={{ fontSize: 'clamp(17px, 4vw, 19px)' }}>
          domino<span style={{ color: LANDING.accent }}>.</span>
        </Link>
        <Link
          href="/login"
          className="touch-manipulation rounded-full no-underline transition-colors hover:opacity-80 active:opacity-70"
          style={{
            border: `1px solid ${LANDING.accent}`,
            borderRadius: 100,
            padding: '9px 20px',
            fontSize: 15,
            fontWeight: 600,
            background: LANDING.loginBg,
            color: LANDING.accent,
          }}
        >
          login
        </Link>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 pb-0 pt-4 text-center md:gap-6 md:px-14 md:pt-16">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2.25rem, 10vw, 92px)',
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: 940,
            textWrap: 'pretty',
            color: LANDING.ink,
          }}
        >
          the things you save, when you actually need them
          <span style={{ color: LANDING.accent }}>.</span>
        </h1>
        <p
          style={{
            fontSize: 'clamp(16px, 4vw, 20px)',
            lineHeight: 1.55,
            color: LANDING.muted,
            margin: 0,
            maxWidth: 560,
            textWrap: 'pretty',
          }}
        >
          domino helps you never lose what you find.
        </p>
        <div className="hidden w-full md:block md:max-w-none">
          <DominoLandingMockups />
        </div>
      </div>

      {/* Mobile: full phones paired with feature copy */}
      <div className="md:hidden">
        <DominoLandingPhonePairs
          items={FEATURES.map(({ variant, activeTile, title, body }) => ({
            variant,
            copy: <FeatureCopy activeTile={activeTile} title={title} body={body} />,
          }))}
        />
      </div>

      {/* Desktop: text-only feature grid */}
      <div className="hidden gap-0 px-5 pb-12 pt-8 md:grid md:grid-cols-3 md:gap-0 md:px-14 md:pb-[88px] md:pt-5">
        {FEATURES.map(({ activeTile, title, body }, index) => (
          <div
            key={title}
            className={`flex flex-col gap-3 md:py-0 ${
              index === 0 ? 'md:pr-9 md:pt-11' : index === 1 ? 'md:border-l md:px-9 md:pt-11' : 'md:border-l md:pl-9 md:pt-11'
            }`}
            style={{ borderColor: LANDING.border }}
          >
            <FeatureCopy activeTile={activeTile} title={title} body={body} />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 px-5 py-8 text-center md:gap-5 md:px-14 md:py-[88px]">
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.875rem, 8vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: '-0.015em',
            color: LANDING.ink,
            textWrap: 'pretty',
          }}
        >
          one link starts it
        </h2>
        <GetStartedButton className="mt-1 md:mt-2" fullWidth />
      </div>

      <div
        className="flex flex-col items-center justify-between gap-5 px-5 py-7 sm:flex-row sm:items-center md:px-14"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
      >
        <span style={{ fontSize: 14, color: LANDING.footer }}>© 2026 daily labs</span>
        <div className="flex items-center gap-6 sm:gap-7">
          {[
            { href: '/faq', label: 'faq' },
            { href: '/privacy', label: 'privacy' },
            { href: '/terms', label: 'terms' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="touch-manipulation no-underline transition-colors hover:opacity-80 active:opacity-70"
              style={{ fontSize: 14, color: LANDING.footer, padding: '4px 0' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
