'use client';

import { useEffect, useMemo, useState } from 'react';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { dominoApi } from '@/features/domino/domino-api';
import { toBookmark, cardColor, timeAgo, type Bookmark } from '@/features/domino/domino-utils';
import { IcBookmark, KindIcon } from '@/features/domino/domino-icons';

function DiscoverContent() {
  const { sessionToken } = useDominoAuth();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    dominoApi.getItems(sessionToken, 200).then(raw => {
      setItems(raw.map(toBookmark));
    }).catch(console.error).finally(() => setFetching(false));
  }, [sessionToken]);

  // My collections: group by every label (main + secondary), sorted by count
  const collections = useMemo(() => {
    const map: Record<string, Bookmark[]> = {};
    items.forEach(it => {
      const cats = it.categories?.length ? it.categories : ['Inbox'];
      cats.forEach(cat => {
        const list = (map[cat] = map[cat] || []);
        if (!list.some(x => x.id === it.id)) list.push(it);
      });
    });
    return Object.entries(map)
      .map(([title, list]) => ({ title, count: list.length, color: list[0].color }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // This week: saved in the last 7 days
  const thisWeek = useMemo(() => {
    return items.filter(it => it.days <= 7).sort((a, b) => a.days - b.days);
  }, [items]);

  if (fetching) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 'var(--dn-text-base)' }}>
        loading…
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 16px' }}>
        <div className="dn-wordmark" style={{ fontSize: 24, marginBottom: 6 }}>discover</div>
        <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
          Patterns across everything you&apos;ve saved.
        </p>
      </div>

      {/* My collections */}
      {collections.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 18px', marginBottom: 10 }}>
            <h3 style={{ fontSize: 'var(--dn-text-md)', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>My collections</h3>
            <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{collections.length} folders</span>
          </div>
          <div className="dn-hscroll" style={{ paddingLeft: 18 }}>
            {collections.map(c => (
              <div key={c.title} style={{
                flexShrink: 0, width: 148, padding: 14,
                borderRadius: 16,
                background: cardColor(c.color),
                display: 'flex', flexDirection: 'column', gap: 8,
                cursor: 'pointer',
              }}>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18,
                  letterSpacing: '-0.01em', lineHeight: 1.2,
                  color: 'var(--ink)',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{c.title}</div>
                <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IcBookmark size={11} /> {c.count} {c.count === 1 ? 'save' : 'saves'}
                </div>
              </div>
            ))}
            <div style={{ flexShrink: 0, width: 18 }} />
          </div>
        </div>
      )}

      {/* This week */}
      {thisWeek.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 18px', marginBottom: 10 }}>
            <h3 style={{ fontSize: 'var(--dn-text-md)', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>This week</h3>
            <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{thisWeek.length} new saves</span>
          </div>
          <div style={{
            margin: '0 18px',
            background: 'var(--paper)',
            border: '1px solid var(--hairline-soft)',
            borderRadius: 16,
            padding: '4px 14px',
          }}>
            {thisWeek.slice(0, 8).map((it, i) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0',
                borderBottom: i < Math.min(thisWeek.length, 8) - 1 ? '1px solid var(--hairline-soft)' : 'none',
              }}>
                <div style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 700, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title || it.domain || 'Untitled'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>
                    {it.domain && (
                      <>
                        <span style={{
                          width: 14, height: 14, fontSize: 8,
                          background: 'var(--bg-deep)', border: '1px solid var(--hairline-soft)',
                          borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, flexShrink: 0,
                        }}>{it.domain[0].toUpperCase()}</span>
                        <span>{it.domain}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                      </>
                    )}
                    <span>{timeAgo(it.days)}</span>
                  </div>
                </div>
                <div style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
                  <KindIcon kind={it.kind} size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ padding: '60px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Nothing here yet</div>
          <p style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Save links, notes, or ideas via iMessage.<br />Patterns will emerge as your library grows.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <DominoProtectedRoute>
      <DominoAppShell>
        <DiscoverContent />
      </DominoAppShell>
    </DominoProtectedRoute>
  );
}
