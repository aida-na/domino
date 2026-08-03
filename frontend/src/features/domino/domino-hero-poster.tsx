'use client';

import Link from 'next/link';
import { Send, Sparkles, Waypoints } from 'lucide-react';
import type { ReactNode } from 'react';

const FEATURES = [
  { icon: Send, text: 'text it any link or thought' },
  { icon: Waypoints, text: 'domino connects it to what you know' },
  { icon: Sparkles, text: "it comes back right when it's useful" },
] as const;

function FeatureRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--bg-deep)',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--ink-2)' }}>{text}</span>
    </li>
  );
}

/** Landing hero — serif headline, three feature rows, light bg. */
export function DominoHeroPoster() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: 'var(--bg)' }}>
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

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-6 md:px-8">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(1.75rem, 6vw, 2.25rem)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            margin: '0 0 16px',
            textWrap: 'balance',
          }}
        >
          the things you save, when you actually need them.
        </h1>

        <p
          style={{
            fontSize: 'clamp(15px, 3.5vw, 16px)',
            lineHeight: 1.55,
            color: 'var(--ink-3)',
            margin: '0 0 28px',
          }}
        >
          domino brings your saved links, notes, and ideas back at the moment they matter — so nothing
          you keep goes to waste.
        </p>

        <ul className="m-0 flex list-none flex-col gap-4 p-0" style={{ marginBottom: 32 }}>
          {FEATURES.map(({ icon: Icon, text }) => (
            <FeatureRow
              key={text}
              icon={<Icon size={18} strokeWidth={1.75} style={{ color: 'var(--domino-accent)' }} />}
              text={text}
            />
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="touch-manipulation inline-flex items-center justify-center rounded-2xl px-6 py-4 text-base font-semibold no-underline transition-opacity hover:opacity-90"
            style={{
              color: '#fff',
              background: 'var(--domino-accent)',
            }}
          >
            get started
          </Link>
          <span className="text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
            free while in beta
          </span>
        </div>
      </div>
    </div>
  );
}
