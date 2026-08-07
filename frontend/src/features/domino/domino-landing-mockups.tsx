'use client';

import Image from 'next/image';

const PHONES = [
  {
    src: '/landing/saved.png',
    alt: 'domino saved screen',
    side: true,
    rotate: '-5deg',
  },
  {
    src: '/landing/map.png',
    alt: 'domino map screen',
    side: false,
    rotate: undefined,
  },
  {
    src: '/landing/ask.png',
    alt: 'domino ask screen',
    side: true,
    rotate: '5deg',
  },
] as const;

function PhoneFrame({
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

/** Screenshot row — dark bezels, center phone larger, side phones tilted on desktop. */
export function DominoLandingMockups() {
  return (
    <div className="landing-phones-wrap">
      <div className="landing-phones-fade" aria-hidden />
      <div className="landing-phones-track">
        {PHONES.map((phone) => (
          <PhoneFrame key={phone.src} {...phone} />
        ))}
      </div>
    </div>
  );
}
