'use client';

import type { ReactNode } from 'react';

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: 220,
        height: 440,
        borderRadius: 32,
        background: 'var(--paper)',
        boxShadow: '0 20px 56px oklch(0 0 0 / 0.11), inset 0 0 0 1px var(--hairline-soft)',
      }}
    >
      <div
        className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full"
        style={{ width: 56, height: 16, background: 'var(--ink)', opacity: 0.08 }}
      />
      <div className="flex h-full flex-col overflow-hidden pt-7">{children}</div>
    </div>
  );
}

function ScreenHeader({ title }: { title: string }) {
  return (
    <div className="border-b px-3 py-2" style={{ borderColor: 'var(--hairline-soft)' }}>
      <span className="dn-wordmark text-[15px]">{title}</span>
    </div>
  );
}

function SavedMock() {
  return (
    <PhoneShell>
      <ScreenHeader title="saved" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2.5 py-2">
        <div
          className="rounded-full px-3 py-1.5 text-[10px]"
          style={{ background: 'var(--bg-deep)', color: 'var(--ink-4)' }}
        >
          search your domino…
        </div>
        <div className="flex gap-1 overflow-hidden">
          {['all', 'culture', 'general', 'technology'].map((chip, i) => (
            <span
              key={chip}
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
              style={{
                background: i === 0 ? 'var(--ink)' : 'var(--bg-deep)',
                color: i === 0 ? 'var(--paper)' : 'var(--ink-3)',
              }}
            >
              {chip}
            </span>
          ))}
        </div>
        <div
          className="rounded-2xl p-2.5"
          style={{ background: 'var(--card-y)', border: '1px solid var(--dn-card-border)' }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
              style={{ background: 'oklch(1 0 0 / 0.7)', color: 'var(--ink-2)' }}
            >
              n
            </span>
            <span className="truncate text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>
              newyorker.com
            </span>
          </div>
          <p className="m-0 line-clamp-2 text-[9px] leading-snug" style={{ color: 'var(--ink-2)' }}>
            wearables are reshaping how we track sleep, stress, and recovery…
          </p>
          <span className="mt-1 block text-[8px]" style={{ color: 'var(--ink-4)' }}>
            2 days ago
          </span>
        </div>
        <div
          className="rounded-2xl p-2.5"
          style={{ background: 'var(--card-b)', border: '1px solid var(--dn-card-border)' }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
              style={{ background: 'oklch(1 0 0 / 0.7)', color: 'var(--ink-2)' }}
            >
              t
            </span>
            <span className="truncate text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>
              techcrunch.com
            </span>
          </div>
          <p className="m-0 line-clamp-2 text-[9px] leading-snug" style={{ color: 'var(--ink-2)' }}>
            the next wave of AI agents will live inside your messaging apps…
          </p>
          <span className="mt-1 block text-[8px]" style={{ color: 'var(--ink-4)' }}>
            5 days ago
          </span>
        </div>
      </div>
    </PhoneShell>
  );
}

function MapMock() {
  const nodes = [
    { x: 50, y: 28, label: 'culture', hub: true },
    { x: 22, y: 58, label: 'newyorker', small: true },
    { x: 78, y: 52, label: 'general', hub: true },
    { x: 50, y: 78, label: 'technology', hub: true },
    { x: 68, y: 88, label: 'techcrunch', small: true },
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [2, 3], [3, 4], [1, 3],
  ];

  return (
    <PhoneShell>
      <ScreenHeader title="map" />
      <div className="relative min-h-0 flex-1" style={{ background: 'var(--bg)' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
              stroke="var(--hairline)"
              strokeWidth="0.6"
              opacity={0.7}
            />
          ))}
          {nodes.map((n, i) => (
            <g key={i}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.hub ? 9 : 6}
                fill={n.hub ? 'var(--paper)' : 'var(--card-o)'}
                stroke="var(--hairline)"
                strokeWidth="0.5"
              />
              <text
                x={n.x}
                y={n.y + (n.small ? 14 : 16)}
                textAnchor="middle"
                fontSize={n.small ? 4.5 : 5}
                fill="var(--ink-3)"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </PhoneShell>
  );
}

function AskMock() {
  return (
    <PhoneShell>
      <ScreenHeader title="ask" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2.5 py-2.5">
        <div className="flex justify-end">
          <div
            className="max-w-[88%] rounded-2xl rounded-br-sm px-2.5 py-1.5 text-[10px] leading-snug"
            style={{ background: 'var(--domino-accent)', color: '#fff' }}
          >
            camping spots near sf?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[92%]">
            <div
              className="rounded-2xl rounded-bl-sm border px-2.5 py-2 text-[10px] leading-snug"
              style={{
                background: 'var(--paper)',
                borderColor: 'var(--hairline-soft)',
                color: 'var(--ink-2)',
              }}
            >
              yes! you saved these a couple of months ago — and this one last week.
            </div>
            <div className="mt-1.5 space-y-1">
              {[
                { title: 'hidden campgrounds near point reyes', topic: 'outdoor' },
                { title: 'best dispersed camping in marin', topic: 'travel' },
              ].map((link) => (
                <div
                  key={link.title}
                  className="rounded-xl border px-2 py-1.5"
                  style={{ borderColor: 'var(--hairline-soft)', background: 'var(--bg)' }}
                >
                  <div className="text-[9px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>
                    {link.title}
                  </div>
                  <div className="text-[8px]" style={{ color: 'var(--ink-4)' }}>
                    {link.topic}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

/** Three static iPhone mockups for the landing page — saved, map, ask. */
export function DominoLandingMockups() {
  return (
    <div className="flex items-end justify-center gap-4 overflow-x-auto px-4 pb-2 md:gap-6">
      <SavedMock />
      <MapMock />
      <AskMock />
    </div>
  );
}
