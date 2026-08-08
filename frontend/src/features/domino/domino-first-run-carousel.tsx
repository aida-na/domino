'use client';

import { useCallback, useState } from 'react';
import { Mail, Smartphone } from 'lucide-react';

const STORAGE_KEY = 'domino_first_run_onboarding_v4';

const DOMINO_IMESSAGE_PHONE = (
  process.env.NEXT_PUBLIC_DOMINO_IMESSAGE_PHONE || '+14249441140'
).replace(/[\s()-]/g, '');

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export function isFirstRunCarouselDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunCarouselDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

const SLIDES = [
  {
    title: 'save our number.',
    body: "it's the number we just texted you from. text it any link you want to keep.",
    hero: 'save',
  },
  {
    title: 'everything links up.',
    body: 'domino connects each save to your other ideas, so your saves become a map, not a pile.',
    hero: 'links',
  },
  {
    title: 'it comes back weekly.',
    body: 'once a week, we send you what you saved — and nudge the ones worth revisiting.',
    hero: 'weekly',
  },
] as const;

function HeroIllustration({ kind }: { kind: (typeof SLIDES)[number]['hero'] }) {
  const heroBg = '#C2521E';
  const floorBg = '#A8461A';

  return (
    <div
      aria-hidden
      style={{
        height: 260,
        background: heroBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 50,
          background: floorBg,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>
        {kind === 'save' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                background: '#FBF8F3',
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 280,
              }}
            >
              <Smartphone size={20} strokeWidth={1.75} style={{ color: 'var(--domino-accent)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9a8b7c', marginBottom: 2 }}>domino</div>
                <div style={{ fontSize: 14, color: '#3A2410', fontWeight: 500 }}>{formatPhone(DOMINO_IMESSAGE_PHONE)}</div>
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  background: '#F3E9D8',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: '#A8461A',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                save
              </span>
            </div>
            <span style={{ color: '#FBF8F3', fontSize: 22, lineHeight: 1 }}>↓</span>
          </div>
        )}
        {kind === 'links' && (
          <svg viewBox="0 0 240 200" style={{ width: 210, height: 175 }} aria-hidden>
            <line x1="120" y1="100" x2="55" y2="50" stroke="#EDE4D0" strokeWidth="1.5" opacity="0.6" />
            <line x1="120" y1="100" x2="190" y2="55" stroke="#EDE4D0" strokeWidth="1.5" opacity="0.6" />
            <line x1="120" y1="100" x2="50" y2="150" stroke="#EDE4D0" strokeWidth="1.5" opacity="0.6" />
            <line x1="120" y1="100" x2="185" y2="150" stroke="#EDE4D0" strokeWidth="1.5" opacity="0.6" />
            <line x1="55" y1="50" x2="190" y2="55" stroke="#EDE4D0" strokeWidth="1.5" opacity="0.35" />
            <circle cx="55" cy="50" r="9" fill="#EDE4D0" opacity="0.75" />
            <circle cx="190" cy="55" r="9" fill="#EDE4D0" opacity="0.75" />
            <circle cx="50" cy="150" r="9" fill="#EDE4D0" opacity="0.75" />
            <circle cx="185" cy="150" r="9" fill="#EDE4D0" opacity="0.75" />
            <circle cx="120" cy="100" r="16" fill="#FBF8F3" />
            <circle cx="120" cy="100" r="16" fill="none" stroke="#FBF8F3" strokeWidth="3" opacity="0.4" />
          </svg>
        )}
        {kind === 'weekly' && (
          <div
            style={{
              background: '#FBF8F3',
              borderRadius: 14,
              padding: 16,
              maxWidth: 220,
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: '#A8461A', fontWeight: 500 }}>
              <Mail size={16} strokeWidth={1.75} style={{ color: 'var(--domino-accent)' }} />
              your weekly domino
            </div>
            <div style={{ fontSize: 13, color: '#3A2410', lineHeight: 1.5 }}>
              3 things you saved this week — and one worth another look.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DominoFirstRunCarousel({ onComplete }: { onComplete: () => void }) {
  const [slide, setSlide] = useState(0);

  const finish = useCallback(() => {
    markFirstRunCarouselDone();
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      finish();
    }
  }, [slide, finish]);

  const current = SLIDES[slide];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#FBF8F3',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        animation: 'dnFadeIn 200ms ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 22px 4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={finish}
          style={{
            background: 'none',
            border: 'none',
            color: '#9a8b7c',
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 8px',
            fontFamily: 'inherit',
          }}
        >
          skip
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <HeroIllustration kind={current.hero} />
        <div style={{ padding: '30px 26px 26px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 25,
              lineHeight: 1.15,
              color: '#241a12',
              margin: '0 0 12px',
              fontWeight: 500,
            }}
          >
            {current.title}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: '#6b5d4f', margin: 0 }}>{current.body}</p>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '12px 26px',
          background: '#FBF8F3',
          borderTop: '0.5px solid rgba(28, 25, 23, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: i === slide ? 'var(--domino-accent)' : '#E0D5C4',
                transition: 'background 200ms',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={advance}
          style={{
            width: '100%',
            background: 'var(--domino-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            padding: 16,
            fontSize: 16,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {slide === SLIDES.length - 1 ? 'get started' : 'next'}
        </button>
      </div>
    </div>
  );
}
