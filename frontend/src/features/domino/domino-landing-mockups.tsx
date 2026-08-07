'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

export type LandingPhoneVariant = 'saved' | 'map' | 'ask';

const PHONE_ROTATE: Partial<Record<LandingPhoneVariant, string>> = {
  saved: '-5deg',
  ask: '5deg',
};

function LandingStatusBar() {
  return (
    <div className="landing-status-bar">
      <span className="landing-status-time">4:35</span>
      <div className="landing-status-island" aria-hidden />
      <div className="landing-status-icons" aria-hidden>
        <svg className="landing-status-icon" viewBox="0 0 19 12" fill="none">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="currentColor" />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="currentColor" />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="currentColor" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="currentColor" />
        </svg>
        <svg className="landing-status-icon" viewBox="0 0 17 12" fill="none">
          <path
            d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"
            fill="currentColor"
          />
          <path
            d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"
            fill="currentColor"
          />
          <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" />
        </svg>
        <svg className="landing-status-icon landing-status-battery" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

function AskMockScreen() {
  return (
    <div className="landing-phone-screen">
      <LandingStatusBar />
      <div className="landing-ask-header">
        <h2 className="landing-screen-title">ask</h2>
      </div>
      <div className="landing-ask-body">
        <div className="landing-ask-row landing-ask-row-user">
          <div className="landing-ask-bubble landing-ask-bubble-user">
            camping spots near sf?
          </div>
        </div>
        <div className="landing-ask-row landing-ask-row-assistant">
          <div className="landing-ask-assistant">
            <div className="landing-ask-bubble landing-ask-bubble-assistant">
              yes! you saved these a couple of months ago — and this one last week.
            </div>
            <div className="landing-ask-links">
              {[
                { title: 'hidden campgrounds near point reyes', topic: 'outdoor' },
                { title: 'best dispersed camping in marin', topic: 'travel' },
              ].map((link) => (
                <div key={link.title} className="landing-ask-link">
                  <span className="landing-ask-link-icon" aria-hidden>
                    ↗
                  </span>
                  <span className="landing-ask-link-copy">
                    <span className="landing-ask-link-title">{link.title}</span>
                    <span className="landing-ask-link-topic">{link.topic}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="landing-ask-input">
        <span className="landing-ask-input-placeholder">search or ask your domino…</span>
      </div>
      <div className="landing-ask-nav" aria-hidden>
        {['saved', 'map', 'ask', 'discover'].map((tab) => (
          <span key={tab} className={`landing-ask-tab${tab === 'ask' ? ' landing-ask-tab-active' : ''}`}>
            {tab}
          </span>
        ))}
      </div>
    </div>
  );
}

function PhoneInner({ variant }: { variant: LandingPhoneVariant }) {
  if (variant === 'saved') {
    return (
      <Image
        src="/landing/saved.png"
        alt="domino saved screen"
        width={300}
        height={648}
        className="landing-phone-img"
        priority
      />
    );
  }
  if (variant === 'map') {
    return (
      <Image
        src="/landing/map.png"
        alt="domino map screen"
        width={300}
        height={648}
        className="landing-phone-img"
        priority
      />
    );
  }
  return <AskMockScreen />;
}

/** Single phone frame — screenshot or ask mock. */
export function LandingPhone({
  variant,
  side = false,
}: {
  variant: LandingPhoneVariant;
  side?: boolean;
}) {
  const rotate = PHONE_ROTATE[variant];
  const inner = <PhoneInner variant={variant} />;

  return (
    <div
      className={`landing-phone ${side ? 'landing-phone-side' : 'landing-phone-center'}`}
      style={
        rotate && side
          ? ({ ['--landing-phone-rotate' as string]: rotate } as React.CSSProperties)
          : undefined
      }
    >
      {inner}
    </div>
  );
}

const DESKTOP_PHONES: { variant: LandingPhoneVariant; side: boolean }[] = [
  { variant: 'saved', side: true },
  { variant: 'map', side: false },
  { variant: 'ask', side: true },
];

/** Desktop trio — horizontal row with tilt and bottom fade. */
export function DominoLandingMockups() {
  return (
    <div className="landing-phones-wrap">
      <div className="landing-phones-fade" aria-hidden />
      <div className="landing-phones-track">
        {DESKTOP_PHONES.map(({ variant, side }) => (
          <LandingPhone key={variant} variant={variant} side={side} />
        ))}
      </div>
    </div>
  );
}

type PhonePairItem = {
  variant: LandingPhoneVariant;
  copy: ReactNode;
};

/** Mobile — full phone paired with feature copy. */
export function DominoLandingPhonePairs({ items }: { items: PhonePairItem[] }) {
  return (
    <div className="landing-phone-pairs">
      {items.map(({ variant, copy }, index) => (
        <div
          key={variant}
          className={`landing-phone-pair${index > 0 ? ' landing-phone-pair--bordered' : ''}`}
        >
          <LandingPhone variant={variant} />
          <div className="landing-phone-pair-copy">{copy}</div>
        </div>
      ))}
    </div>
  );
}
