'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { dominoApi, type DominoItem } from '@/features/domino/domino-api';
import { toBookmark, cardColor, faviconLetter, urlToDisplayTitle, timeAgo, type Bookmark } from '@/features/domino/domino-utils';
import { DominoLogo } from '@/features/domino/domino-logo';
import { IcSearch, IcSort, IcX, IcStar, IcPin, IcShare, IcExt, IcPlus, IcClipboard, KindIcon } from '@/features/domino/domino-icons';

function useMagicLink(loginWithToken: (t: string) => Promise<void>) {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;
    handled.current = true;
    window.history.replaceState({}, '', '/dashboard');
    loginWithToken(token).catch(() => {});
  }, [loginWithToken]);
}

function BookmarkCard({ item, onStar, onPin, onDelete, onOpen }: {
  item: Bookmark;
  onStar: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (item: Bookmark) => void;
}) {
  const [pop, setPop] = useState(false);
  const titleIsUrl = !item.title && item.url;
  const displayTitle = item.title || urlToDisplayTitle(item.url, item.domain);

  return (
    <div className={`dn-card${pop ? ' dn-pop' : ''}`} style={{ background: cardColor(item.color) }} onClick={() => onOpen(item)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'oklch(1 0 0 / 0.7)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <KindIcon kind={item.kind} /> {item.kind}
          </span>
          {item.categories[0] && (
            <span style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'oklch(0 0 0 / 0.05)', color: 'var(--ink-2)' }}>{item.categories[0]}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`dn-icon-btn${item.starred ? ' starred' : ''}`} onClick={(e) => { e.stopPropagation(); setPop(true); setTimeout(() => setPop(false), 280); onStar(item.id); }} aria-label="Star">
            <IcStar size={16} filled={item.starred} />
          </button>
          <button className={`dn-icon-btn${item.pinned ? ' pinned' : ''}`} onClick={(e) => { e.stopPropagation(); onPin(item.id); }} aria-label="Pin">
            <IcPin size={16} filled={item.pinned} />
          </button>
        </div>
      </div>

      {item.kind === 'note' || item.kind === 'pdf' ? (
        <>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0, wordBreak: 'break-word' }}>{displayTitle}</h3>
          {item.snippet && <p style={{ fontSize: 'var(--dn-text-base)', lineHeight: 1.5, color: 'var(--ink-2)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.snippet}</p>}
        </>
      ) : titleIsUrl ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'oklch(1 0 0 / 0.7)', border: '1px solid oklch(0 0 0 / 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--ink-2)', flexShrink: 0 }}>
            {faviconLetter(item.domain)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'var(--dn-text-base)', color: 'var(--ink)', lineHeight: 1.25, letterSpacing: '-0.005em', marginBottom: 4 }}>{urlToDisplayTitle(item.url, item.domain)}</div>
            <div style={{ fontFamily: 'var(--font-jb-mono)', fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', lineHeight: 1.4, wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.url?.replace(/^https?:\/\//, '')}</div>
          </div>
        </div>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>{displayTitle}</h3>
          {item.snippet && <p style={{ fontSize: 'var(--dn-text-base)', lineHeight: 1.5, color: 'var(--ink-2)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.snippet}</p>}
          {item.domain && (
            <a style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', textDecoration: 'none' }} href={item.url!} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer">
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--paper)', border: '1px solid oklch(0 0 0 / 0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{faviconLetter(item.domain)}</span>
              <span style={{ borderBottom: '1px dashed oklch(0 0 0 / 0.2)', paddingBottom: 1 }}>{item.domain}</span>
              <IcExt />
            </a>
          )}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>{timeAgo(item.days)}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="dn-icon-btn" onClick={(e) => { e.stopPropagation(); onOpen(item); }}><IcExt /></button>
          <button className="dn-icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}><IcX /></button>
        </div>
      </div>
    </div>
  );
}

function AddSheet({ token, onClose, onAdd }: { token: string; onClose: () => void; onAdd: (item: DominoItem) => void }) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const isUrl = /^(https?:\/\/|www\.|[\w-]+\.[a-z]{2,})/i.test(input.trim());
  let domain = '';
  try { domain = new URL(input.includes('://') ? input : `https://${input}`).hostname.replace(/^www\./, ''); } catch {}

  async function paste() {
    try { const t = await navigator.clipboard.readText(); if (t) setInput(t); } catch {}
  }

  async function submit() {
    if (!input.trim() || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try { const item = await dominoApi.createItem(token, input.trim()); onAdd(item); }
    catch (e) { console.error(e); savingRef.current = false; setSaving(false); }
  }

  return (
    <>
      <div className="dn-backdrop" onClick={onClose} />
      <div className="dn-sheet">
        <div className="dn-grabber" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em' }}>Save something</div>
          <button className="dn-icon-btn" onClick={onClose}><IcX size={16} /></button>
        </div>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 14, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--ink-4)', paddingTop: 2 }}><IcSearch size={16} /></span>
          <input ref={ref} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="paste a link, or type a note…" style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontFamily: 'var(--font-jb-mono)', fontSize: 'var(--dn-text-base)', color: 'var(--ink)' }} />
          <button className="dn-chip" style={{ height: 30, fontSize: 'var(--dn-text-sm)' }} onClick={paste}><IcClipboard /> paste</button>
        </div>
        {isUrl && domain && (
          <div style={{ marginTop: 14, border: '1px solid var(--hairline)', borderRadius: 14, background: 'var(--paper)', padding: 12, display: 'flex', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--card-m)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>{domain[0].toUpperCase()}</div>
            <div><div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'var(--dn-text-base)', marginBottom: 4, color: 'var(--ink)' }}>{domain}</div><div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', lineHeight: 1.5 }}>We&apos;ll grab the title and summary when you save.</div></div>
          </div>
        )}
        <button onClick={submit} disabled={!input.trim() || saving} style={{ width: '100%', marginTop: 20, height: 50, borderRadius: 14, background: (!input.trim() || saving) ? 'var(--bg-deep)' : 'var(--domino-accent)', color: (!input.trim() || saving) ? 'var(--ink-4)' : 'white', fontWeight: 600, fontSize: 'var(--dn-text-base)', transition: 'all 160ms ease', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : input.trim() ? 'Save to domino' : 'Paste or type something'}
        </button>
      </div>
    </>
  );
}

function DetailSheet({ item, onClose }: { item: Bookmark; onClose: () => void }) {
  const display = item.title || urlToDisplayTitle(item.url, item.domain);
  return (
    <>
      <div className="dn-backdrop" onClick={onClose} />
      <div className="dn-sheet" style={{ maxHeight: '85%' }}>
        <div className="dn-grabber" />
        <div style={{ borderRadius: 18, padding: 18, background: cardColor(item.color), marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'oklch(1 0 0 / 0.7)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><KindIcon kind={item.kind} /> {item.kind}</span>
            {item.categories[0] && <span style={{ fontSize: 'var(--dn-text-sm)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'oklch(0 0 0 / 0.06)', color: 'var(--ink-2)' }}>{item.categories[0]}</span>}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)' }}>{timeAgo(item.days)}</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 10px', wordBreak: 'break-word' }}>{display}</h2>
          {item.snippet && <p style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 14px', whiteSpace: 'pre-line' }}>{item.snippet}</p>}
          {item.domain && (
            <a href={item.url!} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', textDecoration: 'none' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--paper)', border: '1px solid oklch(0 0 0 / 0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{faviconLetter(item.domain)}</span>
              <span style={{ borderBottom: '1px dashed oklch(0 0 0 / 0.2)', paddingBottom: 1 }}>{item.domain}</span>
              <IcExt />
            </a>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
          {[['Star', <IcStar key="s" size={18} filled={item.starred} />], ['Pin', <IcPin key="p" size={18} filled={item.pinned} />], ['Share', <IcShare key="sh" size={18} />], ['Open', <IcExt key="o" size={18} />]].map(([label, ic]) => (
            <button key={label as string} onClick={() => label === 'Open' && item.url ? window.open(item.url, '_blank') : undefined} style={{ background: 'var(--paper)', border: '1px solid var(--hairline-soft)', borderRadius: 12, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--ink-2)', fontSize: 'var(--dn-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {ic}<span>{label as string}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', height: 46, borderRadius: 14, background: 'var(--bg-deep)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 'var(--dn-text-base)', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </>
  );
}

function SavedView() {
  const { sessionToken, loginWithToken } = useDominoAuth();
  useMagicLink(loginWithToken);
  const token = sessionToken!;

  const [rawItems, setRawItems] = useState<DominoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'starred' | 'a-z'>(() => {
    if (typeof window === 'undefined') return 'newest';
    const s = new URLSearchParams(window.location.search).get('sort');
    return s === 'oldest' || s === 'starred' || s === 'a-z' ? s : 'newest';
  });
  const [filter, setFilter] = useState<'all' | 'note' | 'link' | 'pdf' | 'image'>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Bookmark | null>(null);

  const load = useCallback(async () => {
    try { setRawItems(await dominoApi.getItems(token, 500, 0)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sort === 'newest') params.delete('sort');
    else params.set('sort', sort);
    const qs = params.toString();
    const next = qs ? `/dashboard?${qs}` : '/dashboard';
    window.history.replaceState({}, '', next);
  }, [sort]);

  const bookmarks = useMemo(() => rawItems.map(toBookmark), [rawItems]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookmarks.length, note: 0, link: 0, pdf: 0, image: 0 };
    bookmarks.forEach(b => { c[b.kind] = (c[b.kind] || 0) + 1; });
    return c;
  }, [bookmarks]);

  const filtered = useMemo(() => {
    let arr = filter !== 'all' ? bookmarks.filter(b => b.kind === filter) : bookmarks;
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(b => (b.title || '').toLowerCase().includes(q) || (b.url || '').toLowerCase().includes(q) || (b.snippet || '').toLowerCase().includes(q) || b.categories.some(c => c.toLowerCase().includes(q)));
    }
    arr = [...arr];
    if (sort === 'newest') arr.sort((a, b) => a.days - b.days);
    else if (sort === 'oldest') arr.sort((a, b) => b.days - a.days);
    else if (sort === 'starred') arr.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || a.days - b.days);
    else arr.sort((a, b) => (a.title || a.url || '').localeCompare(b.title || b.url || ''));
    return arr;
  }, [bookmarks, filter, query, sort]);

  function toggleStar(id: string) {
    const item = rawItems.find(r => r.id === id);
    if (!item) return;
    const next = !item.is_favorited;
    setRawItems(prev => prev.map(r => r.id === id ? { ...r, is_favorited: next } : r));
    dominoApi.patchItem(token, id, { is_favorited: next }).catch(() => load());
  }
  function togglePin(id: string) {
    const item = rawItems.find(r => r.id === id);
    if (!item) return;
    const next = !item.is_pinned;
    setRawItems(prev => prev.map(r => r.id === id ? { ...r, is_pinned: next } : r));
    dominoApi.patchItem(token, id, { is_pinned: next }).catch(() => load());
  }
  function remove(id: string) {
    setRawItems(prev => prev.filter(r => r.id !== id));
    if (detail?.id === id) setDetail(null);
    dominoApi.deleteItem(token, id).catch(() => load());
  }

  const todayCount = bookmarks.filter(b => b.days === 0).length;
  const sortLabels: Record<string, string> = { newest: 'newest', oldest: 'oldest', starred: 'starred', 'a-z': 'A → Z' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <DominoLogo size="xl" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)', fontSize: 'var(--dn-text-sm)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--domino-accent)', boxShadow: '0 0 0 3px oklch(0.66 0.19 35 / 0.18)' }} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{bookmarks.length} saved{todayCount > 0 ? ` · ${todayCount} today` : ''}</span>
          </div>
        </div>

        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="dn-search-bar" style={{ flex: 1 }}>
            <span style={{ color: 'var(--ink-4)', display: 'flex' }}><IcSearch /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search everything…" />
            {query && <button className="dn-icon-btn" onClick={() => setQuery('')}><IcX /></button>}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSortOpen(o => !o)} style={{ height: 44, padding: '0 14px', border: '1px solid var(--hairline)', borderRadius: 9999, background: 'var(--paper)', fontSize: 'var(--dn-text-base)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <IcSort /> {sortLabels[sort]}
            </button>
            {sortOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setSortOpen(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 11, background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 14, minWidth: 140, padding: 6, boxShadow: '0 10px 30px oklch(0 0 0 / 0.1)' }}>
                  {(['newest', 'oldest', 'starred', 'a-z'] as const).map(s => (
                    <button key={s} onClick={() => { setSort(s); setSortOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 'var(--dn-text-base)', background: sort === s ? 'var(--bg-deep)' : 'transparent', color: sort === s ? 'var(--ink)' : 'var(--ink-2)', fontWeight: sort === s ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', border: 0 }}>
                      {{ newest: 'newest first', oldest: 'oldest first', starred: 'starred first', 'a-z': 'A → Z' }[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--dn-text-md)', fontWeight: 600, margin: 0, color: 'var(--ink-2)', letterSpacing: '-0.01em' }}>My folders</h2>
        </div>
        <div className="dn-hscroll" style={{ paddingBottom: 10, marginRight: -18 }}>
          {(['all', 'note', 'link', 'pdf', 'image'] as const).map(k => (
            <button key={k} className={`dn-chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
              {k === 'all' ? 'all' : `${k}s`}
              <span style={{ color: filter === k ? 'oklch(0.7 0.01 80)' : 'var(--ink-4)' }}>{counts[k] || 0}</span>
            </button>
          ))}
          <div style={{ flexShrink: 0, width: 8 }} />
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-4)', fontFamily: 'var(--font-serif)', fontSize: 'var(--dn-text-base)' }}>loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', border: '1px dashed var(--hairline)' }}><IcSearch size={24} /></div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '12px 0 6px', color: 'var(--ink)' }}>Nothing here yet</h3>
            <p style={{ fontSize: 'var(--dn-text-base)', margin: 0, maxWidth: 240, lineHeight: 1.5 }}>{query ? 'Try a different search.' : 'Save your first link with the + button.'}</p>
          </div>
        ) : (
          <div className="dn-masonry">
            {filtered.map(item => (
              <BookmarkCard key={item.id} item={item} onStar={toggleStar} onPin={togglePin} onDelete={remove} onOpen={setDetail} />
            ))}
          </div>
        )}
      </div>

      <button className="dn-fab" onClick={() => setAddOpen(true)} aria-label="Add"><IcPlus size={22} /></button>
      {addOpen && <AddSheet token={token} onClose={() => setAddOpen(false)} onAdd={(item) => { setRawItems(prev => [item, ...prev]); setAddOpen(false); }} />}
      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DominoProtectedRoute>
      <DominoAppShell><SavedView /></DominoAppShell>
    </DominoProtectedRoute>
  );
}
