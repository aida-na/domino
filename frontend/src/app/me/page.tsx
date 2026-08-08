'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DominoAppShell } from '@/features/domino/domino-app-shell';
import { DominoProtectedRoute } from '@/features/domino/domino-protected-route';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { useDominoTheme } from '@/features/domino/domino-theme';
import { dominoApi, type DominoFriend, type DominoFriendsPendingResponse, type DominoMeResponse } from '@/features/domino/domino-api';
import { inviteUrlFor, shareInvite } from '@/features/domino/domino-invite';
import { toBookmark, cardColor, type Bookmark } from '@/features/domino/domino-utils';
import {
  IcBookmark, IcStar, IcShare, IcChevron, IcX,
  IcPencil, IcUsers, IcUserPlus, IcClock, IcCopy, IcSun,
} from '@/features/domino/domino-icons';
import posthog from 'posthog-js';

const TASTE_THRESHOLD = 5;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function invitedAgo(iso: string | null): string {
  const days = daysSince(iso);
  if (days === null) return 'invited';
  if (days === 0) return 'invited today';
  if (days === 1) return 'invited yesterday';
  return `invited ${days} days ago`;
}

function Dots({ filled, total, size = 8 }: { filled: number; total: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: size, height: size, borderRadius: 9999,
            background: i < filled ? 'var(--domino-accent)' : 'var(--hairline)',
          }}
        />
      ))}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--dn-text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--ink-4)', fontWeight: 600, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function PersonRow({
  avatar,
  name,
  detail,
  action,
}: {
  avatar: ReactNode;
  name: string;
  detail?: string;
  action: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', marginBottom: 8,
      background: 'var(--paper)', borderRadius: 20,
      border: '1px solid var(--dn-card-border)', boxShadow: 'var(--dn-card-shadow)',
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 9999, flexShrink: 0,
        background: 'var(--bg-deep)', color: 'var(--ink-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {avatar}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
        {detail && <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{detail}</span>}
      </span>
      {action}
    </div>
  );
}

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
  profile,
  onClose,
}: {
  token: string;
  profile: DominoMeResponse | null;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<DominoFriend[]>([]);
  const [pending, setPending] = useState<DominoFriendsPendingResponse | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const inviteUrl = inviteUrlFor(profile);
  const inviteLabel = inviteUrl?.replace(/^https?:\/\//, '') ?? null;

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('couldn’t copy link');
    }
  }

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

  async function onShareInvite() {
    setSharing(true);
    setError(null);
    try {
      let me = profile;
      if (!me?.invite_code) {
        me = await dominoApi.getMe(token);
      }
      const url = inviteUrlFor(me);
      if (!url) {
        setError('couldn’t create invite');
        return;
      }
      posthog.capture('invite_shared', { source: 'friends_sheet' });
      await shareInvite(url);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'couldn’t share invite');
    } finally {
      setSharing(false);
    }
  }

  return (
    <SheetShell title="friends" onClose={onClose}>
      {loading ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 'var(--dn-text-base)' }}>loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: 'var(--card-o)', borderRadius: 24, padding: 22,
            display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28,
          }}>
            <div className="dn-wordmark" style={{ fontSize: 24, lineHeight: 1.2, color: 'var(--domino-accent-deep)' }}>
              share your link, connect automatically.
            </div>
            {inviteLabel && (
              <button
                type="button"
                onClick={() => { void copyInvite(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  background: 'var(--paper)', borderRadius: 14, padding: '14px 18px',
                  border: 0, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 'var(--dn-text-sm)', fontWeight: 600, color: 'var(--ink)',
                  letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {copied ? 'copied to clipboard' : inviteLabel}
                </span>
                <span style={{ color: 'var(--ink-3)', flexShrink: 0, display: 'flex' }}><IcCopy size={17} /></span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { void onShareInvite(); }}
              disabled={sharing}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 9999, border: 0,
                background: 'var(--domino-accent)', color: 'white',
                fontSize: 'var(--dn-text-base)', fontWeight: 600,
                cursor: sharing ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {sharing ? 'sharing…' : 'share invite link'}
            </button>
          </div>

          {pending && pending.incoming.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>{pending.incoming.length} waiting for you</SectionLabel>
              {pending.incoming.map((req) => (
                <PersonRow
                  key={req.request_id}
                  avatar={<IcUsers size={17} />}
                  name={req.user.display_name}
                  detail="wants to connect"
                  action={
                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        style={{
                          height: 32, padding: '0 15px', borderRadius: 9999, border: 0,
                          background: 'var(--ink)', color: 'var(--bg)',
                          fontSize: 'var(--dn-text-sm)', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onClick={() => { void dominoApi.acceptFriendRequest(token, req.request_id).then(reload); }}
                      >
                        accept
                      </button>
                      <button
                        type="button"
                        style={{
                          height: 32, padding: '0 15px', borderRadius: 9999,
                          border: '1px solid var(--hairline)', background: 'transparent',
                          color: 'var(--ink-3)', fontSize: 'var(--dn-text-sm)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onClick={() => { void dominoApi.declineFriendRequest(token, req.request_id).then(reload); }}
                      >
                        decline
                      </button>
                    </span>
                  }
                />
              ))}
            </div>
          )}

          {friends.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>your friends · {friends.length}</SectionLabel>
              {friends.map((f) => (
                <PersonRow
                  key={f.friendship_id}
                  avatar={
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-2)' }}>
                      {f.display_name.trim().slice(-1) || '?'}
                    </span>
                  }
                  name={f.display_name}
                  action={
                    <button
                      type="button"
                      style={{
                        height: 32, padding: '0 15px', borderRadius: 9999, flexShrink: 0,
                        border: '1px solid var(--hairline)', background: 'transparent',
                        color: 'oklch(0.55 0.18 27)', fontSize: 'var(--dn-text-sm)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                      onClick={() => { void dominoApi.removeFriend(token, f.friendship_id).then(reload); }}
                    >
                      remove
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {pending && pending.outgoing.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>waiting on {pending.outgoing.length}</SectionLabel>
              {pending.outgoing.map((req) => (
                <PersonRow
                  key={req.request_id}
                  avatar={<IcClock size={17} />}
                  name={req.user.display_name}
                  detail={invitedAgo(req.created_at)}
                  action={
                    <button
                      type="button"
                      style={{
                        height: 32, padding: '0 15px', borderRadius: 9999, flexShrink: 0,
                        border: '1px solid var(--hairline)', background: 'transparent',
                        color: 'var(--ink-3)', fontSize: 'var(--dn-text-sm)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                      onClick={() => { void dominoApi.declineFriendRequest(token, req.request_id).then(reload); }}
                    >
                      cancel
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {friends.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              textAlign: 'center', padding: '4px 20px 28px',
            }}>
              <Dots filled={0} total={3} size={9} />
              <span style={{ fontSize: 'var(--dn-text-base)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                no friends yet. the first one changes what discover can show you.
              </span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowManualAdd((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '16px 18px', borderRadius: 20,
                background: 'var(--paper)', border: '1px solid var(--hairline-soft)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ color: 'var(--ink)', display: 'flex', flexShrink: 0 }}><IcUserPlus size={18} /></span>
              <span style={{ flex: 1, fontSize: 'var(--dn-text-base)', color: 'var(--ink)' }}>
                add by code or phone
              </span>
              <span style={{
                color: 'var(--ink-4)', flexShrink: 0, display: 'flex',
                transform: showManualAdd ? 'rotate(90deg)' : 'none', transition: 'transform 160ms ease',
              }}>
                <IcChevron size={14} />
              </span>
            </button>
            {showManualAdd && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle()}>invite code</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={fieldStyle()} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="abc12345" />
                    <button type="button" className="dn-chip" style={{ height: 44, padding: '0 16px' }} onClick={() => { void sendRequest(); }}>add</button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle()}>phone</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={fieldStyle()} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
                    <button type="button" className="dn-chip" style={{ height: 44, padding: '0 16px' }} onClick={() => { void sendRequest(); }}>add</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 14, fontSize: 'var(--dn-text-sm)', color: 'oklch(0.55 0.18 27)' }}>{error}</div>
          )}
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
      posthog.capture('invite_shared', { source: 'me_tab', result });
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
      icon: <IcPencil size={18} />,
      label: 'edit profile',
      detail: '',
      onClick: () => profile && setSheet('edit'),
    },
    {
      icon: <IcBookmark size={18} />,
      label: 'my folders',
      detail: `${stats.folders}`,
      onClick: () => router.push('/map'),
    },
    {
      icon: <IcStar size={18} />,
      label: 'starred',
      detail: `${stats.starred}`,
      onClick: () => router.push('/dashboard?sort=starred'),
    },
    {
      icon: <IcUsers size={18} />,
      label: 'friends',
      detail: '',
      onClick: () => setSheet('friends'),
    },
    {
      icon: <IcShare size={18} />,
      label: 'share & export',
      detail: '',
      onClick: () => setSheet('export'),
    },
    {
      icon: <IcSun size={18} />,
      label: 'appearance',
      detail: theme === 'dark' ? 'dark' : 'warm light',
      onClick: () => setSheet('appearance'),
    },
  ];

  const savesToTaste = Math.max(0, TASTE_THRESHOLD - stats.total);
  const statCells: { num: number; label: string; href?: string }[] = [
    { num: stats.total, label: 'saved', href: '/dashboard' },
    { num: stats.folders, label: 'on the map', href: '/map' },
    { num: stats.starred, label: 'starred', href: '/dashboard?sort=starred' },
    { num: stats.thisWeek, label: 'this week' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ padding: '14px 18px 0' }}>
        <div className="dn-wordmark" style={{ fontSize: 34, marginBottom: 26 }}>me</div>
      </div>

      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 9999, flexShrink: 0,
            background: cardColor(avatarColor),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 26,
            color: 'var(--domino-accent-deep)', letterSpacing: '-0.02em',
          }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--dn-text-md)', fontWeight: 600, color: 'var(--ink)' }}>
              {profile?.display_name || phone || 'you'}
            </div>
            <div style={{
              fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)', marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {profile?.email || phone || 'domino user'}
              {(profile?.friends_joined_count ?? 0) > 0 && (
                <> · {profile!.friends_joined_count} joined via your invite</>
              )}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--paper)', borderRadius: 22, padding: '24px 4px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          marginBottom: 14,
          border: '1px solid var(--dn-card-border)', boxShadow: 'var(--dn-card-shadow)',
        }}>
          {statCells.map((s, i) => {
            const cell = (
              <>
                <span style={{
                  fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1,
                  color: s.num === 0 ? 'var(--ink-4)' : 'var(--ink)',
                }}>
                  {s.num}
                </span>
                <span style={{ fontSize: 'var(--dn-text-xs)', color: 'var(--ink-3)' }}>{s.label}</span>
              </>
            );
            const cellStyle: CSSProperties = {
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              background: 'transparent', border: 0, fontFamily: 'inherit', padding: 0,
              borderLeftWidth: i > 0 ? 1 : 0,
              borderLeftStyle: 'solid',
              borderLeftColor: 'var(--hairline-soft)',
            };
            return s.href ? (
              <button key={s.label} type="button" onClick={() => router.push(s.href!)} style={{ ...cellStyle, cursor: 'pointer' }}>
                {cell}
              </button>
            ) : (
              <span key={s.label} style={cellStyle}>{cell}</span>
            );
          })}
        </div>

        {savesToTaste > 0 && (
          <div style={{
            background: 'var(--card-o)', borderRadius: 18, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26,
          }}>
            <Dots filled={stats.total} total={TASTE_THRESHOLD} />
            <span style={{ fontSize: 'var(--dn-text-sm)', lineHeight: 1.4, color: 'var(--domino-accent-deep)' }}>
              {savesToTaste} more {savesToTaste === 1 ? 'save' : 'saves'} and domino can start matching your taste.
            </span>
          </div>
        )}

        <div style={{
          background: 'var(--paper)', borderRadius: 22, overflow: 'hidden', marginBottom: 26,
          border: '1px solid var(--dn-card-border)', boxShadow: 'var(--dn-card-shadow)',
        }}>
          {rows.map((row, i) => (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px', width: '100%',
                border: 0,
                borderTop: i > 0 ? '1px solid var(--hairline-soft)' : 'none',
                background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ color: 'var(--ink)', flexShrink: 0, display: 'flex' }}>{row.icon}</span>
              <span style={{ flex: 1, fontSize: 'var(--dn-text-base)', color: 'var(--ink)' }}>{row.label}</span>
              {row.detail && <span style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-3)' }}>{row.detail}</span>}
              <span style={{ color: 'var(--ink-4)', flexShrink: 0, display: 'flex' }}><IcChevron size={12} /></span>
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          paddingBottom: 30,
        }}>
          <button
            type="button"
            onClick={logout}
            style={{
              background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'var(--dn-text-base)', fontWeight: 600, color: 'var(--ink-2)',
            }}
          >
            sign out
          </button>
          <button
            type="button"
            onClick={() => { void deleteAccount(); }}
            style={{
              background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)',
            }}
          >
            delete account
          </button>
          <span style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)',
          }}>
            domino · made with care
          </span>
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
        <FriendsSheet token={sessionToken} profile={profile} onClose={() => setSheet(null)} />
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
            <p style={{ fontSize: 'var(--dn-text-sm)', color: 'var(--ink-4)', margin: '6px 0 0', lineHeight: 1.45 }}>
              your invite links friends to sign up with your referral code.
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
