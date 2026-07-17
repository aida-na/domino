'use client';

import { useId } from 'react';

/** Pip layout on a 3×3 grid (1-indexed, top-left → bottom-right). */
const PIP_POS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function pipCoords(index: number, w: number, h: number) {
  const col = (index - 1) % 3;
  const row = Math.floor((index - 1) / 3);
  const cx = w * (col + 0.5) / 3;
  const cy = h * (row + 0.5) / 3;
  return { cx, cy, r: Math.min(w, h) * 0.11 };
}

function TileHalfPips({
  value,
  y,
  h,
  w,
  pipFill,
}: {
  value: number;
  y: number;
  h: number;
  w: number;
  pipFill: string;
}) {
  const on = PIP_POS[value] ?? [];
  return (
    <>
      {on.map((i) => {
        const { cx, cy, r } = pipCoords(i, w, h);
        return (
          <circle
            key={i}
            cx={cx}
            cy={y + cy}
            r={r}
            fill={pipFill}
          />
        );
      })}
    </>
  );
}

type DominoTileMarkProps = {
  size?: number;
  className?: string;
  top?: number;
  bottom?: number;
};

/** Single domino tile — default 3|5 matches the landing-page chain. */
export function DominoTileMark({
  size = 20,
  className,
  top = 3,
  bottom = 5,
}: DominoTileMarkProps) {
  const uid = useId().replace(/:/g, '');
  const w = size * 0.5;
  const h = size;
  const r = w * 0.18;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 20 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-tile-bg`} x1="4" y1="2" x2="16" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#302418" />
          <stop offset="1" stopColor="#1E1608" />
        </linearGradient>
        <radialGradient id={`${uid}-pip`} cx="35%" cy="35%" r="65%">
          <stop stopColor="#EBE6DC" />
          <stop offset="1" stopColor="#C8BFB0" />
        </radialGradient>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="39"
        rx={r}
        fill={`url(#${uid}-tile-bg)`}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1"
      />
      <TileHalfPips value={top} y={0} h={19} w={20} pipFill={`url(#${uid}-pip)`} />
      <line x1="4" y1="20" x2="16" y2="20" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <TileHalfPips value={bottom} y={20} h={20} w={20} pipFill={`url(#${uid}-pip)`} />
    </svg>
  );
}
