'use client';

import Image from 'next/image';
import Link from 'next/link';

const SIZES = {
  sm: { text: 18, mark: 22, gap: 8 },
  md: { text: 20, mark: 26, gap: 9 },
  lg: { text: 28, mark: 34, gap: 10 },
  xl: { text: 32, mark: 38, gap: 11 },
} as const;

type DominoLogoProps = {
  size?: keyof typeof SIZES;
  showMark?: boolean;
  showDot?: boolean;
  href?: string;
  className?: string;
};

export function DominoLogo({
  size = 'md',
  showMark = true,
  showDot = true,
  href,
  className = '',
}: DominoLogoProps) {
  const { text, mark, gap } = SIZES[size];

  const content = (
    <span
      className={`dn-logo inline-flex items-center lowercase ${className}`}
      style={{ gap, fontSize: text }}
    >
      {showMark ? (
        <Image
          src="/brand/domino-mark.png"
          alt=""
          width={mark}
          height={mark}
          className="shrink-0 rounded-[22%]"
          style={{ width: mark, height: mark }}
          priority={size === 'xl'}
        />
      ) : null}
      <span className="dn-logo-text">
        domino{showDot ? <span className="dn-logo-dot">.</span> : null}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex touch-manipulation">
        {content}
      </Link>
    );
  }

  return content;
}
