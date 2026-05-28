'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { WaitlistModal } from '@/components/WaitlistModal';

const SAMPLE_CARDS = [
  {
    id: '1',
    kind: 'link',
    color: 'b',
    title: 'The Unreasonable Effectiveness of Just Showing Up',
    domain: 'paulgraham.com',
    snippet: 'Consistency compounds in ways that talent alone never can. The people who win long-term are usually not the most gifted — they are the ones who kept going.',
    time: '2h ago',
    starred: true,
    category: 'productivity',
  },
  {
    id: '2',
    kind: 'note',
    color: 'y',
    title: 'q3 product ideas',
    domain: null,
    snippet: 'voice-to-summary on ios, browser ext for one-click save, weekly digest redesign, graph view for connected notes',
    time: 'today',
    starred: false,
    category: null,
  },
  {
    id: '3',
    kind: 'link',
    color: 'm',
    title: 'How Compound Interest Actually Works',
    domain: 'investopedia.com',
    snippet: 'The key insight most people miss: the gains in year 20 are larger than the total gains of years 1–10 combined.',
    time: 'yesterday',
    starred: false,
    category: 'finance',
  },
  {
    id: '4',
    kind: 'note',
    color: 'p',
    title: 'book recs from twitter thread',
    domain: null,
    snippet: 'The Almanack of Naval Ravikant · Thinking in Systems · The Mom Test · Shape Up by Basecamp',
    time: '3d ago',
    starred: true,
    category: null,
  },
];

const CARD_COLORS: Record<string, string> = {
  b: 'oklch(0.94 0.04 230)',
  y: 'oklch(0.965 0.045 100)',
  m: 'oklch(0.95 0.045 165)',
  p: 'oklch(0.93 0.035 350)',
};

function PhoneMockup() {
  const [activeTab, setActiveTab] = useState('saved');
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div style={{
      width: '100%',
      maxWidth: 320,
      margin: '0 auto',
      background: 'var(--bg)',
      borderRadius: 40,
      border: '1px solid var(--hairline)',
      boxShadow: '0 32px 80px oklch(0 0 0 / 0.18), 0 8px 20px oklch(0 0 0 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.6)',
      overflow: 'hidden',
      position: 'relative',
      aspectRatio: '9/19',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* status bar */}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0 24px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>9:41</span>
        <div style={{ width: 120, height: 28, background: 'var(--ink)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1A1208', border: '2px solid oklch(0.4 0 0)' }} />
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="15" height="11" viewBox="0 0 15 11" fill="var(--ink)"><rect x="0" y="4" width="3" height="7" rx="1"/><rect x="4" y="2.5" width="3" height="8.5" rx="1"/><rect x="8" y="1" width="3" height="10" rx="1"/><rect x="12" y="0" width="3" height="11" rx="1"/></svg>
          <svg width="16" height="12" viewBox="0 0 24 12" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"><rect x="1" y="1" width="18" height="10" rx="2"/><path d="M21 4v4" strokeWidth="3" strokeLinecap="round"/><rect x="2.5" y="2.5" width="14" height="7" rx="1" fill="var(--ink)" stroke="none"/></svg>
        </div>
      </div>

      {/* dot-grid texture */}
      <div className="dn-grid-bg" style={{ borderRadius: 0 }} />

      {/* app content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* header */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <div className="dn-wordmark" style={{ fontSize: 24 }}>domino</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--domino-accent)', boxShadow: '0 0 0 2px oklch(0.66 0.19 35 / 0.2)' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>24 saved · 2 today</span>
            </div>
          </div>

          {/* search bar */}
          <div className="dn-search-bar" style={{ height: 36, marginBottom: 10, padding: '0 12px 0 10px' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="6"/><path d="m15 15 3 3"/></svg>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-4)' }}>search everything…</span>
          </div>

          {/* section label */}
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8, letterSpacing: '-0.01em' }}>my folders</div>

          {/* filter chips */}
          <div className="dn-hscroll" style={{ paddingBottom: 10, gap: 6, marginRight: -16 }}>
            {(['all', 'links', 'notes', 'pdfs'] as const).map(k => (
              <button
                key={k}
                className={`dn-chip${activeFilter === k ? ' active' : ''}`}
                style={{ height: 26, padding: '0 10px', fontSize: 11 }}
                onClick={() => setActiveFilter(k)}
              >
                {k}
              </button>
            ))}
            <div style={{ flexShrink: 0, width: 6 }} />
          </div>
        </div>

        {/* cards */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 80px' }} className="scrollbar-hide">
          <div className="dn-masonry" style={{ columnGap: 8 }}>
            {SAMPLE_CARDS.map(card => (
              <div key={card.id} className="dn-card" style={{ background: CARD_COLORS[card.color], marginBottom: 8, padding: 10, borderRadius: 14, gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 5, background: 'oklch(1 0 0 / 0.7)', color: 'var(--ink-2)' }}>
                    {card.kind}
                  </span>
                  {card.starred && (
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="oklch(0.82 0.16 85)" stroke="none"><path d="M10 1l2.4 6.3H19l-5.4 4 2 6.3L10 14l-5.6 3.6 2-6.3L1 7.3h6.6z"/></svg>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 12, lineHeight: 1.3, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.45, color: 'var(--ink-2)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {card.snippet}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, color: 'var(--ink-4)' }}>{card.time}</span>
                  {card.domain && <span style={{ fontSize: 9, color: 'var(--ink-3)', borderBottom: '1px dashed oklch(0 0 0 / 0.2)' }}>{card.domain}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAB */}
        <div style={{
          position: 'absolute', right: 14, bottom: 68,
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--domino-accent)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px oklch(0.66 0.19 35 / 0.45)',
          zIndex: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
        </div>
      </div>

      {/* bottom nav */}
      <nav className="dn-bottom-nav" style={{ gridTemplateColumns: 'repeat(4,1fr)', padding: '6px 4px 16px' }}>
        {([
          { id: 'saved', label: 'saved', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
          { id: 'map', label: 'map', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
          { id: 'discover', label: 'discover', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> },
          { id: 'me', label: 'me', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ]).map(({ id, label, icon }) => (
          <button
            key={id}
            className={`dn-tab${activeTab === id ? ' active' : ''}`}
            style={{ fontSize: 10, gap: 2, padding: '4px 0' }}
            onClick={() => setActiveTab(id)}
          >
            {icon}
            <span>{label}</span>
            {activeTab === id && <div className="dn-tab-dot" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function DominoLandingPage() {
  const { sessionToken, isLoading } = useDominoAuth();
  const router = useRouter();
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background bg-check-grid">
        <span className="w-5 h-5 rounded-full border-2 border-[#ED4715] border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background bg-check-grid text-[#1A1208] font-figtree lowercase overflow-x-hidden leading-snug relative flex flex-col">

      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-compagnon text-xl font-bold tracking-wider text-foreground">
          domino<span className="text-primary">.</span>
        </span>
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-1"
          >
            login
          </Link>
          <button
            type="button"
            onClick={() => setShowWaitlist(true)}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px] inline-flex items-center justify-center -ml-1"
          >
            waitlist
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px 60px', flex: 1, position: 'relative', zIndex: 1 }}>

        {/* hero */}
        <div style={{ marginTop: 40, marginBottom: 36 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 42px)',
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 14,
            color: '#1A1208',
          }}>
            you save things you never revisit.
          </h1>
          <p style={{ fontSize: 'clamp(15px, 3.8vw, 18px)', color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 24px', fontWeight: 400 }}>
            domino turns everything you capture into something that actually compounds — indexed, summarised, and surfaced back when it matters.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowWaitlist(true)}
              style={{
                height: 46, padding: '0 22px', borderRadius: 12,
                background: 'var(--domino-accent)', color: 'white',
                fontWeight: 700, fontSize: 15, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
                boxShadow: '0 4px 16px oklch(0.66 0.19 35 / 0.35)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px oklch(0.66 0.19 35 / 0.4)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px oklch(0.66 0.19 35 / 0.35)'; }}
            >
              join the waitlist →
            </button>
            <Link
              href="/login"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', textDecoration: 'none', padding: '10px 4px' }}
            >
              already have access? login
            </Link>
          </div>
        </div>

        {/* phone mockup */}
        <PhoneMockup />

        {/* how it works */}
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { step: '01', text: 'send any link, thought, or image to domino on whatsapp' },
            { step: '02', text: 'we extract the full text and summarise the key ideas with ai' },
            { step: '03', text: 'search, browse, and chat with everything you\'ve ever saved' },
            { step: '04', text: 'weekly digest resurfaces your best saves at the right moment' },
          ].map(({ step, text }) => (
            <div key={step} style={{
              background: 'var(--paper)',
              border: '1px solid var(--hairline)',
              borderRadius: 16,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--domino-accent)', marginBottom: 6 }}>step {step}</div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: 'var(--ink-2)' }}>{text}</div>
            </div>
          ))}
        </div>

      </div>

      <footer className="shrink-0 flex flex-col gap-2 px-4 py-3 border-t border-border/50 md:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">© 2026 daily labs</span>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">faq</Link>
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">privacy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">terms</Link>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showWaitlist && (
          <WaitlistModal key="waitlist" onClose={() => setShowWaitlist(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
