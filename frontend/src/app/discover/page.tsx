'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import {
  dominoApi,
  type DiscoverFriendsResponse,
  type DiscoverGlobalResponse,
  type DiscoverSimilarResponse,
  type DiscoverStatusResponse,
  type DiscoverTrendItem,
  type DominoMeResponse,
} from '@/features/domino/domino-api';
import { inviteUrlFor, shareInvite } from '@/features/domino/domino-invite';
import posthog from 'posthog-js';
import { toBookmark, cardColor, timeAgo, hashColor, type Bookmark } from '@/features/domino/domino-utils';
import { KindIcon, IcExt } from '@/features/domino/domino-icons';

const TASTE_THRESHOLD = 5;

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '0 22px', marginBottom: 10,
    }}>
      <h3 style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{title}</h3>
      {action ?? (meta && <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{meta}</span>)}
    </div>
  );
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
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 0', textDecoration: 'none', color: 'inherit',
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
      }}>
        {domain?.[0]?.toUpperCase() || '↗'}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 'var(--dn-text-sm)', fontWeight: 600,
          color: 'var(--ink)', lineHeight: 1.35, marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)' }}>
          {domain && <>{domain} · </>}{countLabel}
        </span>
      </span>
      <span style={{ color: 'var(--ink-4)', flexShrink: 0, display: 'flex' }}><IcExt size={13} /></span>
    </a>
  );
}

function TrendingSection({
  title,
  meta,
  items,
  countLabel,
}: {
  title: string;
  meta?: string;
  items: DiscoverTrendItem[];
  countLabel: (n: number) => string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionHeader title={title} meta={meta} />
      <div style={{
        margin: '0 22px',
        background: 'var(--paper)',
        border: '1px solid var(--dn-card-border)',
        boxShadow: 'var(--dn-card-shadow)',
        borderRadius: 22,
        padding: '2px 18px',
      }}>
        {items.map((item, i) => (
          <div key={item.url} style={{
            borderBottom: i < items.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
          }}>
            <TrendingRow item={item} countLabel={countLabel(item.save_count)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscoverContent() {
  const { phone, sessionToken } = useDominoAuth();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [profile, setProfile] = useState<DominoMeResponse | null>(null);
  const [status, setStatus] = useState<DiscoverStatusResponse | null>(null);
  const [globalTrend, setGlobalTrend] = useState<DiscoverGlobalResponse | null>(null);
  const [similar, setSimilar] = useState<DiscoverSimilarResponse | null>(null);
  const [friendsTrend, setFriendsTrend] = useState<DiscoverFriendsResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    Promise.all([
      dominoApi.getItems(sessionToken, 200),
      dominoApi.getMe(sessionToken),
      dominoApi.getDiscoverStatus(sessionToken),
      dominoApi.getGlobalTrending(sessionToken),
      dominoApi.getSimilarTasteTrending(sessionToken),
      dominoApi.getFriendsTrending(sessionToken),
    ]).then(([raw, me, st, global, sim, fr]) => {
      setItems(raw.map(toBookmark));
      setProfile(me);
      setStatus(st);
      setGlobalTrend(global);
      setSimilar(sim);
      setFriendsTrend(fr);
      if (global.items.length > 0) {
        posthog.capture('discover_global_viewed', { item_count: global.items.length });
      }
    }).catch(console.error).finally(() => setFetching(false));
  }, [sessionToken]);

  async function onInviteFriend() {
    if (!sessionToken) return;
    setSharing(true);
    try {
      let me = profile;
      if (!me?.invite_code) {
        me = await dominoApi.getMe(sessionToken);
        setProfile(me);
      }
      const url = inviteUrlFor(me);
      if (!url) return;
      posthog.capture('discover_friends_empty_cta_clicked');
      const result = await shareInvite(url);
      posthog.capture('invite_shared', { source: 'discover_friends_empty', result });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    } finally {
      setSharing(false);
    }
  }

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

  const avatarLetter = (phone?.replace(/\D/g, '').slice(-1)) || '?';

  if (fetching) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 'var(--dn-text-base)' }}>
        loading…
      </div>
    );
  }

  const optInRequired = similar?.opt_in_required || friendsTrend?.opt_in_required;
  const saveCount = status?.item_count ?? items.length;
  const savesToTaste = Math.max(0, TASTE_THRESHOLD - saveCount);
  const showTasteProgress = !optInRequired && savesToTaste > 0;
  const showInviteCard = !optInRequired && (status?.friend_count ?? 0) === 0;
  const similarItems = similar?.items ?? [];
  const friendItems = friendsTrend?.items ?? [];
  const globalItems = globalTrend?.items ?? [];
  const nothingAtAll =
    items.length === 0 && globalItems.length === 0 && similarItems.length === 0 && friendItems.length === 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px 20px',
      }}>
        <div className="dn-wordmark" style={{ fontSize: 34 }}>discover</div>
        <Link
          href="/me"
          aria-label="profile"
          style={{
            width: 36, height: 36, borderRadius: 9999, flexShrink: 0,
            background: 'var(--card-o)', color: 'var(--domino-accent-deep)',
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          {avatarLetter}
        </Link>
      </div>

      {optInRequired && (
        <div style={{
          margin: '0 22px 26px', padding: 20, borderRadius: 24,
          background: 'var(--card-o)',
        }}>
          <div style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            opt in to see personalized trending
          </div>
          <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: 1.5 }}>
            share link urls anonymously (title + url only) to unlock similar-taste and friends trending.
          </p>
          <Link href="/me" style={{
            display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 20px',
            borderRadius: 9999, background: 'var(--domino-accent)', color: 'white',
            fontSize: 'var(--dn-text-sm)', fontWeight: 600, textDecoration: 'none',
          }}>
            open settings
          </Link>
        </div>
      )}

      {collections.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionHeader
            title="your collections"
            action={
              <Link href="/map" style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', textDecoration: 'none' }}>
                see all
              </Link>
            }
          />
          <div
            className="dn-hscroll"
            style={{
              paddingLeft: 22, gap: 12,
              WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 86%, transparent 99%)',
              maskImage: 'linear-gradient(to right, #000 0, #000 86%, transparent 99%)',
            }}
          >
            {collections.map(c => (
              <div key={c.title} style={{
                flexShrink: 0, width: 150, height: 104, padding: 16,
                borderRadius: 20, boxSizing: 'border-box',
                background: cardColor(c.color),
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <span style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(c.count, 3) }, (_, i) => (
                    <span key={i} style={{
                      width: 9, height: 9, borderRadius: 9999,
                      background: 'var(--ink-3)', opacity: 0.55,
                    }} />
                  ))}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20,
                    letterSpacing: '-0.01em', lineHeight: 1.15, color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.title}
                  </span>
                  <span style={{ fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)' }}>
                    {c.count} {c.count === 1 ? 'save' : 'saves'}
                  </span>
                </span>
              </div>
            ))}
            <div style={{ flexShrink: 0, width: 22 }} />
          </div>
        </div>
      )}

      {showTasteProgress && (
        <div style={{
          margin: '0 22px 16px', padding: '22px 24px', borderRadius: 24,
          background: 'var(--ink)', color: 'var(--bg)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <span style={{
            fontSize: 'var(--dn-text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--ink-4)', fontWeight: 600,
          }}>
            your map is still forming
          </span>
          <span style={{
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 25,
            lineHeight: 1.15, letterSpacing: '-0.01em',
          }}>
            {saveCount} of {TASTE_THRESHOLD} saves until domino can find your people.
          </span>
          <span style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {Array.from({ length: TASTE_THRESHOLD }, (_, i) => (
              <span key={i} style={{
                flex: 1, height: 5, borderRadius: 9999,
                background: i < saveCount ? 'var(--domino-accent)' : 'oklch(0.32 0.012 60)',
              }} />
            ))}
          </span>
          <span style={{ fontSize: 'var(--dn-text-sm)', lineHeight: 1.5, color: 'var(--ink-4)' }}>
            {savesToTaste} more and we&apos;ll surface what people with your taste are reading.
          </span>
        </div>
      )}

      {showInviteCard && (
        <div style={{
          margin: '0 22px 28px', padding: '20px 24px', borderRadius: 24,
          background: 'var(--paper)',
          border: '1px solid var(--dn-card-border)', boxShadow: 'var(--dn-card-shadow)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {(['o', 'v', 'm'] as const).map((key, i) => (
              <span key={key} style={{
                width: 34, height: 34, borderRadius: 9999,
                background: cardColor(key), border: '2px solid var(--paper)',
                marginLeft: i === 0 ? 0 : -10,
              }} />
            ))}
            <span style={{
              width: 34, height: 34, borderRadius: 9999, marginLeft: -10,
              background: 'var(--bg-deep)', border: '2px solid var(--paper)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: 'var(--ink-3)',
            }}>+</span>
          </span>
          <span style={{ fontSize: 'var(--dn-text-md)', fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)' }}>
            invite the friend who sends you things — you&apos;ll auto-connect when they join.
          </span>
          <button
            type="button"
            onClick={() => { void onInviteFriend(); }}
            disabled={sharing}
            style={{
              alignSelf: 'flex-start', marginTop: 2,
              background: 'var(--domino-accent)', color: 'white',
              fontSize: 'var(--dn-text-sm)', fontWeight: 600,
              borderRadius: 9999, padding: '12px 24px', border: 0,
              cursor: sharing ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {sharing ? 'sharing…' : 'invite someone'}
          </button>
        </div>
      )}

      {thisWeek.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="this week" meta={`${thisWeek.length} new saves`} />
          <div style={{
            margin: '0 22px',
            background: 'var(--paper)',
            border: '1px solid var(--dn-card-border)',
            boxShadow: 'var(--dn-card-shadow)',
            borderRadius: 22,
            padding: '2px 18px',
          }}>
            {thisWeek.slice(0, 8).map((it, i) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 0',
                borderBottom: i < Math.min(thisWeek.length, 8) - 1 ? '1px solid var(--hairline-soft)' : 'none',
              }}>
                <div style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 700, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', minWidth: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title || it.domain || 'Untitled'}
                  </p>
                  <div style={{ fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)' }}>
                    {it.domain && <>{it.domain} · </>}{timeAgo(it.days)}
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

      {globalItems.length > 0 && (
        <TrendingSection
          title="trending on domino"
          meta={`${globalItems.length} links`}
          items={globalItems}
          countLabel={(n) => `${n} ${n === 1 ? 'person' : 'people'} saved this`}
        />
      )}

      {similarItems.length > 0 && (
        <TrendingSection
          title="trending with similar taste"
          meta={`${similarItems.length} links`}
          items={similarItems}
          countLabel={(n) => `${n} people with similar taste`}
        />
      )}

      {friendItems.length > 0 && (
        <TrendingSection
          title="trending among friends"
          meta={friendsTrend?.friend_count ? `${friendsTrend.friend_count} friends` : undefined}
          items={friendItems}
          countLabel={(n) => `${n} ${n === 1 ? 'friend' : 'friends'} saved this`}
        />
      )}

      {nothingAtAll && !showTasteProgress && !showInviteCard && (
        <div style={{
          padding: '32px 34px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <span style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: 9999, background: 'var(--hairline)' }} />
            ))}
          </span>
          <p style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>
            nothing here yet. save links over iMessage and patterns will start to show up.
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
