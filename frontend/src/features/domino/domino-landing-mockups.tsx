'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

function PhoneSlot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="landing-phone-slot">
      {children}
      <span className="landing-phone-label">{label}</span>
    </div>
  );
}

function ScreenshotPhone({
  src,
  alt,
  side,
  rotate,
}: {
  src: string;
  alt: string;
  side: boolean;
  rotate?: string;
}) {
  return (
    <div
      className={`landing-phone ${side ? 'landing-phone-side' : 'landing-phone-center'}`}
      style={
        rotate
          ? ({ ['--landing-phone-rotate' as string]: rotate } as React.CSSProperties)
          : undefined
      }
    >
      <Image
        src={src}
        alt={alt}
        width={300}
        height={648}
        className="landing-phone-img"
        priority
      />
    </div>
  );
}

function AskMockScreen() {
  return (
    <div className="landing-phone-screen">
      <div className="landing-ask-header">
        <span className="dn-wordmark landing-ask-title">ask</span>
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

function AskMockPhone({ rotate }: { rotate?: string }) {
  return (
    <div
      className="landing-phone landing-phone-side"
      style={
        rotate
          ? ({ ['--landing-phone-rotate' as string]: rotate } as React.CSSProperties)
          : undefined
      }
    >
      <AskMockScreen />
    </div>
  );
}

/** Screenshot row — stacked on mobile, trio with tilt on desktop. */
export function DominoLandingMockups() {
  return (
    <div className="landing-phones-wrap">
      <div className="landing-phones-fade" aria-hidden />
      <div className="landing-phones-track">
        <PhoneSlot label="saved">
          <ScreenshotPhone src="/landing/saved.png" alt="domino saved screen" side rotate="-5deg" />
        </PhoneSlot>
        <PhoneSlot label="map">
          <ScreenshotPhone src="/landing/map.png" alt="domino map screen" side={false} />
        </PhoneSlot>
        <PhoneSlot label="ask">
          <AskMockPhone rotate="5deg" />
        </PhoneSlot>
      </div>
    </div>
  );
}
