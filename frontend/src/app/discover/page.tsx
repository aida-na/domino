'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import {
  dominoApi,
  type DiscoverFriendsResponse,
  type DiscoverSimilarResponse,
  type DiscoverStatusResponse,
  type DiscoverTrendItem,
} from '@/features/domino/domino-api';
import { toBookmark, cardColor, timeAgo, hashColor, type Bookmark } from '@/features/domino/domino-utils';
import { IcBookmark, KindIcon } from '@/features/domino/domino-icons';

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function TrendingRow({ item, countLabel }: { item: DiscoverTrendItem; countLabel: string }) {
  const domain = domainFromUrl(item.url);
  const tint = cardColor(hashColor(item.topic || 'Inbox'));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 0',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
      }}>
        {domain?.[0]?.toUpperCase() || '↗'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </p>
        <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>
          {domain && <span>{domain} · </span>}
          <span>{countLabel}</span>
        </div>
      </div>
    </a>
  );
}

function TrendingSection({
  title,
  meta,
  items,
  empty,
  countLabel,
}: {
  title: string;
  meta?: string;
  items: DiscoverTrendItem[];
  empty: React.ReactNode;
  countLabel: (n: number) => string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 18px', marginBottom: 10 }}>
        <h3 style={{ fontSize: 'var(--dn-text-md)', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{title}</h3>
        {meta && <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{meta}</span>}
      </div>
      <div style={{
        margin: '0 18px',
        background: 'var(--paper)',
        border: '1px solid var(--hairline-soft)',
        borderRadius: 16,
        padding: '4px 14px',
      }}>
        {items.length > 0 ? (
          items.map((item, i) => (
            <div key={item.url} style={{
              borderBottom: i < items.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
            }}>
              <TrendingRow item={item} countLabel={countLabel(item.save_count)} />
            </div>
          ))
        ) : (
          <div style={{ padding: '18px 4px', fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverContent() {
  const { sessionToken } = useDominoAuth();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [status, setStatus] = useState<DiscoverStatusResponse | null>(null);
  const [similar, setSimilar] = useState<DiscoverSimilarResponse | null>(null);
  const [friendsTrend, setFriendsTrend] = useState<DiscoverFriendsResponse | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    Promise.all([
      dominoApi.getItems(sessionToken, 200),
      dominoApi.getDiscoverStatus(sessionToken),
      dominoApi.getSimilarTasteTrending(sessionToken),
      dominoApi.getFriendsTrending(sessionToken),
    ]).then(([raw, st, sim, fr]) => {
      setItems(raw.map(toBookmark));
      setStatus(st);
      setSimilar(sim);
      setFriendsTrend(fr);
    }).catch(console.error).finally(() => setFetching(false));
  }, [sessionToken]);

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

  const optInRequired = similar?.opt_in_required || friendsTrend?.opt_in_required;

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ padding: '14px 18px 16px' }}>
        <div className="dn-wordmark" style={{ fontSize: 24, marginBottom: 6 }}>discover</div>
        <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
          What people with your taste — and your friends — are saving this week.
        </p>
      </div>

      {optInRequired && (
        <div style={{
          margin: '0 18px 24px', padding: 16, borderRadius: 16,
          background: 'var(--card-o)', border: '1px solid var(--hairline-soft)',
        }}>
          <div style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            opt in to see trending saves
          </div>
          <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Share link URLs anonymously (title + URL only) to unlock similar-taste and friends trending.
          </p>
          <Link href="/me" style={{
            display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 14px',
            borderRadius: 9999, background: 'var(--ink)', color: 'var(--bg)',
            fontSize: 'var(--dn-text-sm)', fontWeight: 600, textDecoration: 'none',
          }}>
            open settings
          </Link>
        </div>
      )}

      <TrendingSection
        title="Trending with similar taste"
        meta={similar?.items.length ? `${similar.items.length} links` : undefined}
        items={similar?.items ?? []}
        countLabel={(n) => `${n} people with similar taste`}
        empty={
          !status?.opt_in ? (
            <>Turn on discover sharing in <Link href="/me" style={{ color: 'var(--domino-accent)' }}>settings</Link>.</>
          ) : !status.taste_ready ? (
            <>Save a few more links first — we need at least 5 saves to match your taste.</>
          ) : (
            <>Nothing trending yet. Check back as more people save this week.</>
          )
        }
      />

      <TrendingSection
        title="Trending among friends"
        meta={friendsTrend?.friend_count ? `${friendsTrend.friend_count} friends` : undefined}
        items={friendsTrend?.items ?? []}
        countLabel={(n) => `${n} ${n === 1 ? 'friend' : 'friends'} saved this`}
        empty={
          !status?.opt_in ? (
            <>Turn on discover sharing in <Link href="/me" style={{ color: 'var(--domino-accent)' }}>settings</Link>.</>
          ) : (status.friend_count ?? 0) === 0 ? (
            <>Add friends in <Link href="/me" style={{ color: 'var(--domino-accent)' }}>settings</Link> to see what they&apos;re saving.</>
          ) : (
            <>No friend saves this week yet.</>
          )
        }
      />

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

      {items.length === 0 && !similar?.items.length && !friendsTrend?.items.length && (
        <div style={{ padding: '40px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Nothing here yet</div>
          <p style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Save links via iMessage to build your library and unlock discover.
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
