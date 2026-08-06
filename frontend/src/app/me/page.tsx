'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { useDominoTheme } from '@/features/domino/domino-theme';
import { dominoApi, type DominoFriend, type DominoFriendsPendingResponse, type DominoMeResponse } from '@/features/domino/domino-api';
import { toBookmark, cardColor, type Bookmark } from '@/features/domino/domino-utils';
import { IcBookmark, IcStar, IcShare, IcCompass, IcChevron, IcX } from '@/features/domino/domino-icons';
import posthog from 'posthog-js';

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

type Sheet = 'edit' | 'export' | 'appearance' | 'friends' | null;

function fieldStyle(): CSSProperties {
  return {
    width: '100%',
    height: 44,
    padding: '0 14px',
    borderRadius: 12,
    border: '1px solid var(--hairline)',
    background: 'var(--paper)',
    color: 'var(--ink)',
    fontSize: 'var(--dn-text-base)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function labelStyle(): CSSProperties {
  return {
    fontSize: 'var(--dn-text-sm)',
    fontWeight: 600,
    color: 'var(--ink-3)',
    marginBottom: 6,
    display: 'block',
  };
}

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="dn-backdrop" onClick={onClose} />
      <div className="dn-sheet" style={{ maxHeight: '88dvh' }}>
        <div className="dn-grabber" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
            {title}
          </h2>
          <button className="dn-icon-btn" onClick={onClose} aria-label="Close"><IcX size={18} /></button>
        </div>
        {children}
      </div>
    </>
  );
}

function FriendsSheet({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<DominoFriend[]>([]);
  const [pending, setPending] = useState<DominoFriendsPendingResponse | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([
        dominoApi.getFriends(token),
        dominoApi.getFriendsPending(token),
      ]);
      setFriends(f.friends);
      setPending(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'couldn’t load friends');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [f, p] = await Promise.all([
          dominoApi.getFriends(token),
          dominoApi.getFriendsPending(token),
        ]);
        if (!cancelled) {
          setFriends(f.friends);
          setPending(p);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'couldn’t load friends');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function sendRequest() {
    setError(null);
    try {
      if (inviteCode.trim()) {
        await dominoApi.sendFriendRequest(token, { invite_code: inviteCode.trim() });
        setInviteCode('');
      } else if (phone.trim()) {
        await dominoApi.sendFriendRequest(token, { phone: phone.trim() });
        setPhone('');
      } else {
        setError('enter a phone number or invite code');
        return;
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    }
  }

  return (
    <SheetShell title="friends" onClose={onClose}>
      {loading ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 'var(--dn-text-base)' }}>loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle()}>add by invite code</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={fieldStyle()} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="abc12345" />
              <button type="button" className="dn-chip" style={{ height: 44, padding: '0 16px' }} onClick={() => { void sendRequest(); }}>add</button>
            </div>
          </div>
          <div>
            <label style={labelStyle()}>add by phone</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={fieldStyle()} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
              <button type="button" className="dn-chip" style={{ height: 44, padding: '0 16px' }} onClick={() => { void sendRequest(); }}>add</button>
            </div>
          </div>

          {pending && pending.incoming.length > 0 && (
            <div>
              <div style={labelStyle()}>incoming requests</div>
              {pending.incoming.map((req) => (
                <div key={req.request_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 'var(--dn-text-base)' }}>{req.user.display_name}</span>
                  <button type="button" className="dn-chip" style={{ height: 34 }} onClick={() => { void dominoApi.acceptFriendRequest(token, req.request_id).then(reload); }}>accept</button>
                  <button type="button" className="dn-chip" style={{ height: 34 }} onClick={() => { void dominoApi.declineFriendRequest(token, req.request_id).then(reload); }}>decline</button>
                </div>
              ))}
            </div>
          )}

          {pending && pending.outgoing.length > 0 && (
            <div>
              <div style={labelStyle()}>pending</div>
              {pending.outgoing.map((req) => (
                <div key={req.request_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)' }}>{req.user.display_name}</span>
                  <button type="button" className="dn-chip" style={{ height: 34 }} onClick={() => { void dominoApi.declineFriendRequest(token, req.request_id).then(reload); }}>cancel</button>
                </div>
              ))}
            </div>
          )}

          <div>
            <div style={labelStyle()}>your friends ({friends.length})</div>
            {friends.length === 0 ? (
              <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', margin: 0 }}>No friends yet — add someone by invite code or phone.</p>
            ) : (
              friends.map((f) => (
                <div key={f.friendship_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 'var(--dn-text-base)' }}>{f.display_name}</span>
                  <button type="button" className="dn-chip" style={{ height: 34, color: 'oklch(0.55 0.18 27)' }} onClick={() => { void dominoApi.removeFriend(token, f.friendship_id).then(reload); }}>remove</button>
                </div>
              ))
            )}
          </div>

          {error && <div style={{ fontSize: 'var(--dn-text-sm)', color: 'oklch(0.55 0.18 27)' }}>{error}</div>}
        </div>
      )}
    </SheetShell>
  );
}

function EditProfileSheet({
  token,
  profile,
  hasPassword,
  onClose,
  onSaved,
}: {
  token: string;
  profile: DominoMeResponse;
  hasPassword: boolean | null;
  onClose: () => void;
  onSaved: (me: DominoMeResponse) => void;
}) {
  const { refreshProfile } = useDominoAuth();
  const [email, setEmail] = useState(profile.email ?? '');
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [digestTime, setDigestTime] = useState(profile.digest_time?.slice(0, 5) || '08:00');
  const [discoverOptIn, setDiscoverOptIn] = useState(Boolean(profile.discover_opt_in));
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const me = await dominoApi.updateMe(token, {
        email: email.trim() || null,
        display_name: displayName.trim() || null,
        timezone,
        digest_time: digestTime,
        discover_opt_in: discoverOptIn,
      });
      if (password) {
        if (password.length < 8) throw new Error('password must be at least 8 characters');
        if (password !== passwordConfirm) throw new Error('passwords do not match');
        await dominoApi.setPassword(token, password, passwordConfirm);
        await refreshProfile();
        setPassword('');
        setPasswordConfirm('');
      }
      onSaved(me);
      setNotice('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'couldn’t save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetShell title="edit profile" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle()}>phone</label>
          <div style={{ ...fieldStyle(), display: 'flex', alignItems: 'center', color: 'var(--ink-3)' }}>
            {profile.phone}
          </div>
        </div>
        <div>
          <label style={labelStyle()}>display name (for friends)</label>
          <input
            style={fieldStyle()}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="optional"
            maxLength={32}
          />
        </div>
        <div>
          <label style={labelStyle()}>email (weekly digest)</label>
          <input
            style={fieldStyle()}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label style={labelStyle()}>timezone</label>
          <select style={fieldStyle()} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {[timezone, ...TIMEZONES.filter((z) => z !== timezone)].map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>digest time</label>
          <input
            style={fieldStyle()}
            type="time"
            value={digestTime}
            onChange={(e) => setDigestTime(e.target.value)}
          />
        </div>
        <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: 14 }}>
          <label style={{ ...labelStyle(), display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={discoverOptIn}
              onChange={(e) => setDiscoverOptIn(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ display: 'block', color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>
                share saves anonymously in discover
              </span>
              <span style={{ fontWeight: 400, lineHeight: 1.45 }}>
                Only link URLs and titles — never notes, images, or who saved what.
              </span>
            </span>
          </label>
        </div>
        <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: 14 }}>
          <label style={labelStyle()}>{hasPassword ? 'change password' : 'set a password'}</label>
          <input
            style={{ ...fieldStyle(), marginBottom: 8 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="optional · min 8 characters"
            autoComplete="new-password"
          />
          {password && (
            <input
              style={fieldStyle()}
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="confirm password"
              autoComplete="new-password"
            />
          )}
        </div>
        {error && <div style={{ fontSize: 'var(--dn-text-base)', color: 'oklch(0.55 0.18 27)' }}>{error}</div>}
        {notice && <div style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)' }}>{notice}</div>}
        <button
          onClick={save}
          disabled={saving}
          style={{
            height: 48,
            borderRadius: 14,
            border: 0,
            background: 'var(--domino-accent)',
            color: 'white',
            fontSize: 'var(--dn-text-base)',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'saving…' : 'save'}
        </button>
      </div>
    </SheetShell>
  );
}

function inviteUrlFor(profile: DominoMeResponse | null): string | null {
  if (profile?.invite_url) return profile.invite_url;
  if (profile?.invite_code) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://domino.fyi';
    return `${origin}/login?ref=${profile.invite_code}`;
  }
  return null;
}

async function shareInvite(url: string): Promise<'shared' | 'copied'> {
  const data = {
    title: 'join me on domino',
    text: 'i use domino to save links & notes over iMessage — here’s your invite:',
    url,
  };
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }
  await navigator.clipboard.writeText(
    `join me on domino — your second brain via iMessage\n${url}`,
  );
  return 'copied';
}

function MeContent() {
  const router = useRouter();
  const { phone, logout, sessionToken, hasPassword, refreshProfile } = useDominoAuth();
  const { theme, setTheme } = useDominoTheme();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [profile, setProfile] = useState<DominoMeResponse | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    dominoApi.getItems(sessionToken, 500).then((raw) => {
      setItems(raw.map(toBookmark));
    }).catch(console.error);
    dominoApi.getMe(sessionToken).then(setProfile).catch(console.error);
  }, [sessionToken]);

  const stats = useMemo(() => {
    const total = items.length;
    const starred = items.filter((i) => i.starred).length;
    const folders = new Set(items.flatMap((i) => i.categories || [])).size;
    const thisWeek = items.filter((i) => i.days <= 7).length;
    return { total, starred, folders, thisWeek };
  }, [items]);

  const weekBars = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    const todayDow = (today.getDay() + 6) % 7;
    items.forEach((it) => {
      if (it.days < 7) {
        const idx = (todayDow - it.days + 7) % 7;
        days[idx]++;
      }
    });
    const max = Math.max(...days, 1);
    return days.map((v) => v / max);
  }, [items]);

  const digits = phone?.replace(/\D/g, '') ?? '';
  const initial = digits.slice(-1) || '?';
  const avatarColor = phone ? ['o', 'p', 'v', 'm', 'b'][phone.length % 5] : 'o';
  const inviteUrl = inviteUrlFor(profile);

  async function onShareDomino() {
    if (!sessionToken) return;
    setSharing(true);
    try {
      let me = profile;
      if (!me?.invite_code) {
        me = await dominoApi.getMe(sessionToken);
        setProfile(me);
      }
      const url = inviteUrlFor(me);
      if (!url) {
        showToast('couldn’t create invite');
        return;
      }
      const result = await shareInvite(url);
      if (result === 'copied') showToast('invite copied');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      showToast('couldn’t share invite');
    } finally {
      setSharing(false);
    }
  }

  function exportJson() {
    if (!sessionToken) return;
    dominoApi.exportAccount(sessionToken).then((payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `domino-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      posthog.capture('account_export_completed');
      showToast('export downloaded');
      setSheet(null);
    }).catch(() => showToast('export failed'));
  }

  async function deleteAccount() {
    if (!sessionToken) return;
    const typed = window.prompt("type 'delete' to permanently delete your account and all saves");
    if (typed?.trim().toLowerCase() !== 'delete') return;
    let password: string | undefined;
    if (hasPassword) {
      password = window.prompt('enter your password to confirm') ?? undefined;
      if (!password) return;
    }
    try {
      await dominoApi.deleteAccount(sessionToken, password);
      posthog.capture('account_deleted');
      showToast('account deleted');
      await logout();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'delete failed');
    }
  }

  const rows: {
    icon: ReactNode;
    label: string;
    detail: string;
    onClick: () => void;
  }[] = [
    {
      icon: <IcBookmark size={16} />,
      label: 'My folders',
      detail: `${stats.folders} folders`,
      onClick: () => router.push('/map'),
    },
    {
      icon: <IcStar size={16} />,
      label: 'Starred',
      detail: `${stats.starred} items`,
      onClick: () => router.push('/dashboard?sort=starred'),
    },
    {
      icon: <IcCompass size={16} />,
      label: 'Friends',
      detail: profile?.discover_opt_in ? 'manage' : '',
      onClick: () => setSheet('friends'),
    },
    {
      icon: <IcShare size={16} />,
      label: 'Share & export',
      detail: '',
      onClick: () => setSheet('export'),
    },
    {
      icon: <IcCompass size={16} />,
      label: 'Appearance',
      detail: theme === 'dark' ? 'dark' : 'warm light',
      onClick: () => setSheet('appearance'),
    },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ padding: '14px 18px 0' }}>
        <div className="dn-wordmark" style={{ fontSize: 24, marginBottom: 16 }}>me</div>
      </div>

      <div style={{ padding: '0 18px' }}>
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
            <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', marginTop: 2 }}>
              {profile?.email || 'domino user'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className="dn-chip"
            style={{ flex: 1, justifyContent: 'center', height: 38, fontSize: 'var(--dn-text-base)' }}
            onClick={() => profile && setSheet('edit')}
            disabled={!profile}
          >
            edit profile
          </button>
          <button
            type="button"
            className="dn-chip"
            style={{
              flex: 1, justifyContent: 'center', height: 38, fontSize: 'var(--dn-text-base)',
              background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)',
              opacity: sharing ? 0.7 : 1,
            }}
            onClick={onShareDomino}
            disabled={sharing}
          >
            {sharing ? 'creating…' : 'share invite'}
          </button>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginBottom: 16,
        }}>
          {[
            { num: stats.total, label: 'saved', href: '/dashboard' },
            { num: stats.starred, label: 'starred', href: '/dashboard?sort=starred' },
            { num: stats.folders, label: 'folders', href: '/map' },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => router.push(s.href)}
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--hairline-soft)',
                borderRadius: 14, padding: '14px 10px',
                textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {s.num}
              </div>
              <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', marginTop: 4 }}>{s.label}</div>
            </button>
          ))}
        </div>

        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline-soft)',
          borderRadius: 14, padding: 14, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--dn-text-md)', fontWeight: 600, color: 'var(--ink)' }}>This week</div>
            <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{stats.thisWeek} new saves</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
            {weekBars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(v * 36, 4)}px`,
                  background: i === ((new Date().getDay() + 6) % 7) ? 'var(--domino-accent)' : 'var(--card-y)',
                  borderRadius: 4,
                  transition: 'height 240ms ease',
                }} />
                <div style={{ fontSize: 'var(--dn-text-xs)', color: 'var(--ink-4)' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline-soft)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 20,
        }}>
          {rows.map((row, i, arr) => (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px', width: '100%',
                border: 0,
                borderBottom: i < arr.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
                background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{row.icon}</div>
              <div style={{ flex: 1, fontSize: 'var(--dn-text-base)', color: 'var(--ink)', fontWeight: 500 }}>{row.label}</div>
              {row.detail && <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{row.detail}</div>}
              <div style={{ color: 'var(--ink-4)', flexShrink: 0 }}><IcChevron size={14} /></div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%', padding: '13px 14px',
            background: 'var(--paper)',
            border: '1px solid var(--hairline-soft)',
            borderRadius: 14, cursor: 'pointer',
            fontSize: 'var(--dn-text-base)', color: 'oklch(0.55 0.18 27)',
            fontWeight: 500, textAlign: 'left', fontFamily: 'inherit',
          }}
        >
          sign out
        </button>

        <div style={{
          textAlign: 'center', marginTop: 22,
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)',
        }}>
          domino · made with care
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)',
          background: 'var(--ink)', color: 'var(--bg)',
          padding: '10px 16px', borderRadius: 9999, fontSize: 'var(--dn-text-base)', fontWeight: 500,
          zIndex: 50, whiteSpace: 'nowrap',
          animation: 'dnFadeIn 200ms ease',
        }}>
          {toast}
        </div>
      )}

      {sheet === 'friends' && sessionToken && (
        <FriendsSheet token={sessionToken} onClose={() => setSheet(null)} />
      )}

      {sheet === 'edit' && profile && sessionToken && (
        <EditProfileSheet
          token={sessionToken}
          profile={profile}
          hasPassword={hasPassword}
          onClose={() => setSheet(null)}
          onSaved={(me) => {
            setProfile(me);
            refreshProfile().catch(() => {});
          }}
        />
      )}

      {sheet === 'export' && (
        <SheetShell title="share & export" onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inviteUrl && (
              <div style={{
                padding: 12, borderRadius: 12,
                border: '1px solid var(--hairline-soft)',
                background: 'var(--bg-deep)',
                fontSize: 'var(--dn-text-sm)', color: 'var(--ink-2)',
                wordBreak: 'break-all',
                fontFamily: 'var(--font-jb-mono)',
              }}>
                {inviteUrl}
              </div>
            )}
            <button
              type="button"
              className="dn-chip"
              style={{ height: 44, justifyContent: 'center', width: '100%' }}
              onClick={() => { void onShareDomino(); }}
              disabled={sharing}
            >
              {sharing ? 'creating…' : 'share invite link'}
            </button>
            <button
              type="button"
              className="dn-chip"
              style={{ height: 44, justifyContent: 'center', width: '100%' }}
              onClick={exportJson}
            >
              download my data (json)
            </button>
            <button
              type="button"
              style={{
                height: 44, width: '100%', borderRadius: 12,
                border: '1px solid oklch(0.88 0.08 27)',
                background: 'transparent',
                color: 'oklch(0.55 0.18 27)',
                fontSize: 'var(--dn-text-base)', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              onClick={() => { void deleteAccount(); }}
            >
              delete account
            </button>
            <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)', margin: '6px 0 0', lineHeight: 1.45 }}>
              your invite links friends to sign up with your referral code.
              deleting your account removes all saves permanently.
            </p>
          </div>
        </SheetShell>
      )}

      {sheet === 'appearance' && (
        <SheetShell title="appearance" onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { id: 'light' as const, title: 'warm light', detail: 'soft paper + burnt orange' },
              { id: 'dark' as const, title: 'dark', detail: 'ink black + amber accent' },
            ]).map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: 14, borderRadius: 14,
                    border: active ? '1px solid var(--ink)' : '1px solid var(--hairline-soft)',
                    background: 'var(--paper)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)' }}>{opt.title}</div>
                  <div style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', marginTop: 4 }}>
                    {active ? 'current · ' : ''}{opt.detail}
                  </div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}
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
