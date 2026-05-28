'use client';

import { useEffect, useMemo, useState } from 'react';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { dominoApi } from '@/features/domino/domino-api';
import { toBookmark, cardColor, type Bookmark } from '@/features/domino/domino-utils';
import { IcBookmark, IcStar, IcLink, IcShare, IcCompass, IcChevron } from '@/features/domino/domino-icons';

function MeContent() {
  const { phone, logout, sessionToken } = useDominoAuth();
  const [items, setItems] = useState<Bookmark[]>([]);

  useEffect(() => {
    if (!sessionToken) return;
    dominoApi.getItems(sessionToken, 200).then(raw => {
      setItems(raw.map(toBookmark));
    }).catch(console.error);
  }, [sessionToken]);

  const stats = useMemo(() => {
    const total = items.length;
    const starred = items.filter(i => i.starred).length;
    const folders = new Set(items.flatMap(i => i.categories || [])).size;
    const thisWeek = items.filter(i => i.days <= 7).length;
    return { total, starred, folders, thisWeek };
  }, [items]);

  // Build weekly bar data from items saved in last 7 days
  const weekBars = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0]; // Mon–Sun relative to today
    const today = new Date();
    const todayDow = (today.getDay() + 6) % 7; // Mon=0, Sun=6
    items.forEach(it => {
      if (it.days < 7) {
        const idx = (todayDow - it.days + 7) % 7;
        days[idx]++;
      }
    });
    const max = Math.max(...days, 1);
    return days.map(v => v / max);
  }, [items]);

  const initial = phone ? phone.replace(/\D/g, '').slice(-4, -3) || '?' : '?';
  const avatarColor = phone ? ['o', 'p', 'v', 'm', 'b'][phone.length % 5] : 'o';

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ padding: '14px 18px 0' }}>
        <div className="dn-wordmark" style={{ fontSize: 24, marginBottom: 16 }}>me</div>
      </div>

      <div style={{ padding: '0 18px' }}>
        {/* Avatar + profile */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: cardColor(avatarColor),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 28,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>{initial}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {phone || 'you'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>domino user</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className="dn-chip" style={{ flex: 1, justifyContent: 'center', height: 38, fontSize: 13 }}>
            edit profile
          </button>
          <button className="dn-chip" style={{
            flex: 1, justifyContent: 'center', height: 38, fontSize: 13,
            background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)',
          }}>
            share domino
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginBottom: 16,
        }}>
          {[
            { num: stats.total, label: 'saved' },
            { num: stats.starred, label: 'starred' },
            { num: stats.folders, label: 'folders' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--paper)',
              border: '1px solid var(--hairline-soft)',
              borderRadius: 14, padding: '14px 10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {s.num}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* This week chart */}
        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline-soft)',
          borderRadius: 14, padding: 14, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>This week</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{stats.thisWeek} new saves</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
            {weekBars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(v * 36, 4)}px`,
                  background: i === 6 ? 'var(--domino-accent)' : 'var(--card-y)',
                  borderRadius: 4,
                  transition: 'height 240ms ease',
                }} />
                <div style={{ fontSize: 9, color: 'var(--ink-4)' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline-soft)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 20,
        }}>
          {[
            { icon: <IcBookmark size={16} />, label: 'My folders', detail: `${stats.folders} folders` },
            { icon: <IcStar size={16} />, label: 'Starred', detail: `${stats.starred} items` },
            { icon: <IcLink size={16} />, label: 'Connected accounts', detail: '' },
            { icon: <IcShare size={16} />, label: 'Share & export', detail: '' },
            { icon: <IcCompass size={16} />, label: 'Appearance', detail: 'warm light' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{row.icon}</div>
              <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{row.label}</div>
              {row.detail && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{row.detail}</div>}
              <div style={{ color: 'var(--ink-4)', flexShrink: 0 }}><IcChevron size={14} /></div>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '13px 14px',
            background: 'var(--paper)',
            border: '1px solid var(--hairline-soft)',
            borderRadius: 14, cursor: 'pointer',
            fontSize: 13.5, color: 'oklch(0.55 0.18 27)',
            fontWeight: 500, textAlign: 'left',
          }}
        >
          sign out
        </button>

        <div style={{
          textAlign: 'center', marginTop: 22,
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 12, color: 'var(--ink-4)',
        }}>
          domino · made with care
        </div>
      </div>
    </div>
  );
}

export default function MePage() {
  return (
    <DominoProtectedRoute>
      <DominoAppShell>
        <MeContent />
      </DominoAppShell>
    </DominoProtectedRoute>
  );
}
