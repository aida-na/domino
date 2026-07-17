'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { dominoApi } from '@/features/domino/domino-api';
import { toBookmark, cardColor, type Bookmark } from '@/features/domino/domino-utils';
import { KindIcon } from '@/features/domino/domino-icons';

const CANVAS_W = 1100;
const CANVAS_H = 1100;
const NODE_W = 112;
const NODE_H = 64;

interface DragState {
  type: 'hub' | 'node' | 'pan';
  id: string | null;
  startX: number;
  startY: number;
  startDelta: { dx: number; dy: number };
  t: number;
  moved: boolean;
}

function MapCanvas({ items, onOpen }: { items: Bookmark[]; onOpen: (item: Bookmark) => void }) {
  const folders = useMemo(() => {
    const seen: string[] = [];
    items.forEach(it => (it.categories || []).forEach(c => {
      if (!seen.includes(c)) seen.push(c);
    }));
    return seen;
  }, [items]);

  const baseHubs = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    folders.forEach((cat, i) => {
      const ring = i < 5 ? 0 : 1;
      const inRing = ring === 0 ? Math.min(folders.length, 5) : Math.max(folders.length - 5, 1);
      const idx = ring === 0 ? i : i - 5;
      const radius = ring === 0 ? 180 : 380;
      const offset = ring === 1 ? Math.PI / inRing : -Math.PI / 2;
      const angle = (idx / inRing) * Math.PI * 2 + offset;
      out[cat] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    return out;
  }, [folders]);

  const baseNodes = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    const byCat: Record<string, Bookmark[]> = {};
    items.forEach(it => {
      const cat = it.categories?.[0] || 'misc';
      (byCat[cat] = byCat[cat] || []).push(it);
    });
    Object.entries(byCat).forEach(([cat, list]) => {
      const hub = baseHubs[cat];
      if (!hub) return;
      const n = list.length;
      const orbitR = 125 + Math.min(n, 5) * 4;
      list.forEach((it, i) => {
        const baseAngle = (i / n) * Math.PI * 2;
        const jitter = ((it.id.charCodeAt(it.id.length - 1) % 11) - 5) / 50;
        const angle = baseAngle + jitter;
        out[it.id] = {
          x: hub.x + Math.cos(angle) * orbitR,
          y: hub.y + Math.sin(angle) * orbitR,
        };
      });
    });
    return out;
  }, [items, baseHubs]);

  const [hubDelta, setHubDelta] = useState<Record<string, { dx: number; dy: number }>>({});
  const [nodeDelta, setNodeDelta] = useState<Record<string, { dx: number; dy: number }>>({});
  const [scale, setScale] = useState(0.55);
  const [cam, setCam] = useState({ x: -100, y: 20 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const hubs = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    folders.forEach(cat => {
      const b = baseHubs[cat];
      const d = hubDelta[cat] || { dx: 0, dy: 0 };
      out[cat] = { x: b.x + d.dx, y: b.y + d.dy };
    });
    return out;
  }, [folders, baseHubs, hubDelta]);

  const nodes = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    items.forEach(it => {
      const b = baseNodes[it.id];
      if (!b) return;
      const d = nodeDelta[it.id] || { dx: 0, dy: 0 };
      const cat = it.categories?.[0];
      const hd = cat ? (hubDelta[cat] || { dx: 0, dy: 0 }) : { dx: 0, dy: 0 };
      out[it.id] = { x: b.x + hd.dx + d.dx, y: b.y + hd.dy + d.dy };
    });
    return out;
  }, [items, baseNodes, nodeDelta, hubDelta]);

  const edges = useMemo(() => {
    const out: { id: string; x1: number; y1: number; x2: number; y2: number; primary: boolean }[] = [];
    items.forEach(it => {
      (it.categories || []).forEach((cat, idx) => {
        const hub = hubs[cat];
        const node = nodes[it.id];
        if (hub && node) out.push({
          id: it.id + '@' + cat,
          x1: hub.x, y1: hub.y,
          x2: node.x, y2: node.y,
          primary: idx === 0,
        });
      });
    });
    return out;
  }, [items, hubs, nodes]);

  function curve(e: { x1: number; y1: number; x2: number; y2: number }) {
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const mx = (e.x1 + e.x2) / 2;
    const my = (e.y1 + e.y2) / 2;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * 14;
    const ny = dx / len * 14;
    return `M ${e.x1} ${e.y1} Q ${mx + nx} ${my + ny} ${e.x2} ${e.y2}`;
  }

  function onPointerDown(e: React.PointerEvent, type: 'hub' | 'node', id: string) {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const startDelta = type === 'hub'
      ? (hubDelta[id] || { dx: 0, dy: 0 })
      : (nodeDelta[id] || { dx: 0, dy: 0 });
    dragRef.current = { type, id, startX: e.clientX, startY: e.clientY, startDelta, t: e.timeStamp, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;
    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
    if (dr.type === 'hub' && dr.id) {
      setHubDelta(p => ({ ...p, [dr.id!]: { dx: dr.startDelta.dx + dx / scale, dy: dr.startDelta.dy + dy / scale } }));
    } else if (dr.type === 'node' && dr.id) {
      setNodeDelta(p => ({ ...p, [dr.id!]: { dx: dr.startDelta.dx + dx / scale, dy: dr.startDelta.dy + dy / scale } }));
    } else if (dr.type === 'pan') {
      setCam({ x: dr.startDelta.dx + dx, y: dr.startDelta.dy + dy });
    }
  }

  function onPointerUp(e: React.PointerEvent, item?: Bookmark) {
    const dr = dragRef.current;
    if (dr && !dr.moved && (e.timeStamp - dr.t) < 250 && item) {
      onOpen(item);
    }
    dragRef.current = null;
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = {
      type: 'pan', id: null,
      startX: e.clientX, startY: e.clientY,
      startDelta: { dx: cam.x, dy: cam.y },
      t: e.timeStamp, moved: false,
    };
  }

  function fit() {
    const xs: number[] = [];
    const ys: number[] = [];
    folders.forEach(c => { const h = hubs[c]; if (h) { xs.push(h.x); ys.push(h.y); } });
    items.forEach(it => { const n = nodes[it.id]; if (n) { xs.push(n.x); ys.push(n.y); } });
    if (!xs.length) return;
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 80;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const w = maxX - minX, h = maxY - minY;
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const sx = vp.width / w;
    const sy = vp.height / h;
    const s = Math.min(sx, sy, 1.2);
    setScale(s);
    setCam({
      x: vp.width / 2 - ((minX + maxX) / 2) * s,
      y: vp.height / 2 - ((minY + maxY) / 2) * s,
    });
  }

  function zoom(delta: number) {
    setScale(s => Math.max(0.3, Math.min(1.5, s + delta)));
  }

  function reset() {
    setHubDelta({});
    setNodeDelta({});
    setScale(0.55);
    setCam({ x: -100, y: 20 });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 8px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="dn-wordmark" style={{ fontSize: 24, marginBottom: 6 }}>map</div>
            <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
              Folders cluster the saves they hold. Drag anything · pan the bg.
            </p>
          </div>
          <button className="dn-chip" onClick={reset} style={{ height: 30, fontSize: 'var(--dn-text-sm)' }}>reset</button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={viewportRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(-e.deltaY * 0.002); } }}
      >
        <div className="dn-grid-bg" style={{ pointerEvents: 'none' }} />

        <div style={{
          position: 'absolute',
          left: cam.x, top: cam.y,
          width: CANVAS_W, height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}>
          {/* Edges */}
          <svg width={CANVAS_W} height={CANVAS_H}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {edges.map(e => (
              <path
                key={e.id}
                d={curve(e)}
                fill="none"
                stroke={e.primary ? 'oklch(0.4 0.02 60 / 0.45)' : 'oklch(0.5 0.04 35 / 0.4)'}
                strokeWidth={e.primary ? 1.3 : 1}
                strokeDasharray={e.primary ? '0' : '3 5'}
                strokeLinecap="round"
              />
            ))}
            {edges.filter(e => e.primary).map(e => (
              <circle key={'d' + e.id} cx={e.x2} cy={e.y2} r="2" fill="oklch(0.4 0.02 60 / 0.5)" />
            ))}
          </svg>

          {/* Hubs */}
          {folders.map(cat => {
            const h = hubs[cat];
            if (!h) return null;
            const count = items.filter(it => (it.categories || []).includes(cat)).length;
            return (
              <div
                key={'hub-' + cat}
                onPointerDown={(e) => onPointerDown(e, 'hub', cat)}
                onPointerUp={(e) => onPointerUp(e)}
                style={{
                  position: 'absolute',
                  left: h.x - 56, top: h.y - 22,
                  width: 112, height: 44,
                  borderRadius: 22,
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600, fontSize: 'var(--dn-text-base)', letterSpacing: '-0.01em',
                  cursor: 'grab', userSelect: 'none',
                  boxShadow: '0 6px 20px oklch(0 0 0 / 0.18)',
                  zIndex: 2, whiteSpace: 'nowrap',
                }}>
                <span>{cat}</span>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--dn-text-xs)', fontWeight: 600,
                  background: 'oklch(1 0 0 / 0.18)', borderRadius: 9999,
                  padding: '2px 6px', letterSpacing: '0.02em',
                }}>{count}</span>
              </div>
            );
          })}

          {/* Item nodes */}
          {items.map(it => {
            const p = nodes[it.id];
            if (!p) return null;
            const isNote = it.kind === 'note';
            const label = it.title || it.domain || it.url || 'untitled';
            return (
              <div
                key={it.id}
                onPointerDown={(e) => onPointerDown(e, 'node', it.id)}
                onPointerUp={(e) => onPointerUp(e, it)}
                style={{
                  position: 'absolute',
                  left: p.x - NODE_W / 2, top: p.y - NODE_H / 2,
                  width: NODE_W, minHeight: NODE_H,
                  borderRadius: 14,
                  background: cardColor(it.color),
                  padding: '8px 10px',
                  boxShadow: '0 3px 12px oklch(0 0 0 / 0.07)',
                  cursor: 'grab', userSelect: 'none',
                  border: '1px solid oklch(0 0 0 / 0.04)',
                  zIndex: 3,
                }}>
                <div style={{
                  display: 'flex', gap: 4, alignItems: 'center',
                  color: 'var(--ink-3)', fontSize: 'var(--dn-text-xs)', marginBottom: 4,
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>
                  <KindIcon kind={it.kind} size={9} />
                  <span>{it.kind}</span>
                </div>
                <div style={{
                  fontFamily: isNote ? 'var(--font-serif)' : 'var(--font-sans)',
                  fontWeight: 600, fontSize: 'var(--dn-text-base)',
                  color: 'var(--ink)', lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  letterSpacing: isNote ? '-0.005em' : '0',
                }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'oklch(1 0 0 / 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--hairline-soft)',
          borderRadius: 10,
          padding: '6px 10px',
          fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)',
          display: 'flex', gap: 12, alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="oklch(0.4 0.02 60 / 0.5)" strokeWidth="1.4" /></svg>
            primary
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="oklch(0.5 0.04 35 / 0.5)" strokeWidth="1.2" strokeDasharray="3 4" /></svg>
            also in
          </span>
        </div>

        {/* Zoom controls */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
          alignItems: 'flex-end',
        }}>
          <div style={{
            background: 'oklch(1 0 0 / 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--hairline-soft)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.06)',
          }}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoom(0.15)}
              style={{ width: 32, height: 32, fontSize: 18, color: 'var(--ink-2)', borderBottom: '1px solid var(--hairline-soft)' }}
              aria-label="Zoom in"
            >+</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoom(-0.15)}
              style={{ width: 32, height: 32, fontSize: 18, color: 'var(--ink-2)', borderBottom: '1px solid var(--hairline-soft)' }}
              aria-label="Zoom out"
            >−</button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={fit}
              style={{ width: 32, height: 32, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Fit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          </div>
          <div style={{
            background: 'oklch(1 0 0 / 0.85)',
            border: '1px solid var(--hairline-soft)',
            borderRadius: 8,
            padding: '2px 7px',
            fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}>{Math.round(scale * 100)}%</div>
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState<Bookmark | null>(null);

  useEffect(() => {
    if (!isLoading && !sessionToken) {
      router.replace('/login');
    }
  }, [isLoading, sessionToken, router]);

  useEffect(() => {
    if (!sessionToken) return;
    dominoApi.getItems(sessionToken, 200).then(raw => {
      setItems(raw.map(toBookmark));
    }).catch(console.error).finally(() => setFetching(false));
  }, [sessionToken]);

  if (isLoading || fetching) {
    return (
      <DominoAppShell>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 'var(--dn-text-base)' }}>
          loading map…
        </div>
      </DominoAppShell>
    );
  }

  return (
    <DominoAppShell>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MapCanvas items={items} onOpen={setSelected} />
      </div>

      {/* Detail sheet */}
      {selected && (
        <>
          <div className="dn-backdrop" onClick={() => setSelected(null)} />
          <div className="dn-sheet" style={{ maxHeight: '55dvh' }}>
            <div className="dn-grabber" />
            <div style={{ padding: '0 18px 24px' }}>
              <div style={{
                display: 'flex', gap: 6, alignItems: 'center',
                color: 'var(--ink-3)', fontSize: 'var(--dn-text-sm)', marginBottom: 10,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <KindIcon kind={selected.kind} size={11} />
                <span>{selected.categories[0] || selected.kind}</span>
              </div>
              <div style={{
                fontFamily: selected.kind === 'note' ? 'var(--font-serif)' : 'inherit',
                fontWeight: 600, fontSize: 18, color: 'var(--ink)',
                lineHeight: 1.3, marginBottom: 8,
              }}>
                {selected.title || selected.domain || 'Untitled'}
              </div>
              {selected.snippet && (
                <p style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {selected.snippet.slice(0, 200)}
                </p>
              )}
              {selected.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 'var(--dn-text-sm)', color: 'var(--domino-accent)',
                    textDecoration: 'none',
                  }}
                >
                  {selected.domain || selected.url}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8" /></svg>
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </DominoAppShell>
  );
}
