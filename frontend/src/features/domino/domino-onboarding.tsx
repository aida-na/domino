'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { dominoApi } from '@/features/domino/domino-api';
import { IcChevron, IcX } from '@/features/domino/domino-icons';
import posthog from 'posthog-js';

const STORAGE_KEY = 'domino_onboarding_v1';

/** Public Domino iMessage / SMS number (override with NEXT_PUBLIC_DOMINO_IMESSAGE_PHONE). */
const DOMINO_IMESSAGE_PHONE = (
  process.env.NEXT_PUBLIC_DOMINO_IMESSAGE_PHONE || '+14249441140'
).replace(/[\s()-]/g, '');

export function openDominoIMessage(): void {
  window.location.href = `sms:${DOMINO_IMESSAGE_PHONE}`;
}

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

type Step = 'save' | 'email';

/** Minimal B&W shelf — three cards, no color, no ornaments. */
function SaveIllustration() {
  return (
    <div
      aria-hidden
      className="dn-pop"
      style={{ height: 112, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <svg width="168" height="100" viewBox="0 0 168 100" fill="none">
        <rect x="18" y="28" width="52" height="64" rx="10" transform="rotate(-8 44 60)" fill="#F4F1EC" stroke="#1C1917" strokeWidth="1.5" />
        <rect x="58" y="16" width="52" height="72" rx="10" fill="#1C1917" />
        <rect x="70" y="30" width="28" height="3" rx="1.5" fill="#F4F1EC" opacity="0.55" />
        <rect x="70" y="40" width="22" height="3" rx="1.5" fill="#F4F1EC" opacity="0.35" />
        <rect x="70" y="50" width="26" height="3" rx="1.5" fill="#F4F1EC" opacity="0.25" />
        <circle cx="84" cy="72" r="7" stroke="#F4F1EC" strokeWidth="1.5" fill="none" />
        <path d="M84 68.5v7M80.5 72h7" stroke="#F4F1EC" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="98" y="30" width="52" height="62" rx="10" transform="rotate(8 124 61)" fill="#F4F1EC" stroke="#1C1917" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** Minimal B&W envelope — outline only. */
function DigestIllustration() {
  return (
    <div
      aria-hidden
      className="dn-pop"
      style={{ height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="148" height="96" viewBox="0 0 148 96" fill="none">
        <rect x="22" y="28" width="104" height="56" rx="10" fill="#F4F1EC" stroke="#1C1917" strokeWidth="1.5" />
        <path d="M22 28 L74 58 L126 28" fill="#1C1917" />
        <path d="M22 40 L74 66 L126 40" stroke="#1C1917" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function primaryBtn(disabled?: boolean): CSSProperties {
  return {
    width: '100%',
    height: 48,
    borderRadius: 14,
    background: disabled ? 'var(--bg-deep)' : 'var(--ink)',
    color: disabled ? 'var(--ink-4)' : 'var(--paper)',
    fontWeight: 600,
    fontSize: 'var(--dn-text-base)',
    border: 0,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  };
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: i === current ? 14 : 5,
            height: 5,
            borderRadius: 99,
            background: i === current ? 'var(--ink)' : 'var(--hairline)',
            transition: 'width 200ms ease, background 200ms ease',
          }}
        />
      ))}
    </div>
  );
}

function StepSwitch({
  onBack,
  onNext,
}: {
  onBack?: () => void;
  onNext?: () => void;
}) {
  const chip: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid var(--hairline)',
    background: 'var(--paper)',
    color: 'var(--ink)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Previous" style={chip}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}>
            <IcChevron size={14} />
          </span>
        </button>
      )}
      {onNext && (
        <button type="button" onClick={onNext} aria-label="Next" style={chip}>
          <IcChevron size={14} />
        </button>
      )}
    </div>
  );
}

function ModalShell({
  stepLabel,
  stepSwitch,
  onClose,
  illustration,
  children,
}: {
  stepLabel: ReactNode;
  stepSwitch?: ReactNode;
  onClose: () => void;
  illustration: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="dn-backdrop"
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 18px max(16px, env(safe-area-inset-bottom))',
        zIndex: 50,
        background: 'oklch(0.18 0.01 60 / 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dn-onboarding-title"
        className="dn-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          maxHeight: 'min(88dvh, 720px)',
          overflow: 'auto',
          borderRadius: 24,
          background: 'var(--paper)',
          border: '1px solid oklch(0 0 0 / 0.08)',
          boxShadow: '0 28px 64px oklch(0.15 0.01 60 / 0.32)',
        }}
      >
        <div style={{ padding: '16px 18px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {stepLabel}
              {stepSwitch}
            </div>
            <button className="dn-icon-btn" onClick={onClose} aria-label="Close" type="button">
              <IcX size={16} />
            </button>
          </div>
          <div style={{ marginTop: 6 }}>{illustration}</div>
        </div>
        <div style={{ padding: '8px 22px 20px' }}>{children}</div>
      </div>
    </div>
  );
}

export function DominoOnboardingSheet({
  token,
  hasItems,
  hasEmail,
  initialEmail,
  initialStep,
  onComplete,
  onEmailSaved,
}: {
  token: string;
  hasItems: boolean;
  hasEmail: boolean;
  initialEmail?: string | null;
  /** Preview / testing override for the starting step. */
  initialStep?: Step;
  onComplete: () => void;
  onEmailSaved?: (email: string) => void;
}) {
  const [includeSaveStep] = useState(!hasItems || initialStep === 'save');
  const [step, setStep] = useState<Step>(
    () => initialStep ?? (hasItems && !hasEmail ? 'email' : 'save'),
  )
  const [email, setEmail] = useState(initialEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish() {
    markOnboardingDone();
    onComplete();
  }

  useEffect(() => {
    if (!hasItems || step !== 'save') return;
    if (hasEmail) {
      markOnboardingDone();
      onComplete();
      return;
    }
    setStep('email');
  }, [hasItems, hasEmail, step, onComplete]);

  async function saveEmail() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const me = await dominoApi.updateMe(token, { email: trimmed, digest_opted_out: false });
      posthog.capture('digest_email_saved');
      onEmailSaved?.(me.email ?? trimmed);
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'couldn’t save email');
    } finally {
      setSaving(false);
    }
  }

  const stepLabel = includeSaveStep ? (
    <StepDots current={step === 'save' ? 0 : 1} total={2} />
  ) : (
    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
      almost
    </span>
  );

  if (step === 'save') {
    return (
      <ModalShell
        stepLabel={stepLabel}
        stepSwitch={
          includeSaveStep ? (
            <StepSwitch onNext={() => (hasEmail ? finish() : setStep('email'))} />
          ) : undefined
        }
        onClose={finish}
        illustration={<SaveIllustration />}
      >
        <h2
          id="dn-onboarding-title"
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--font-serif)',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        >
          save your first thing
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.45,
            color: 'var(--ink-2)',
            textAlign: 'center',
            textWrap: 'balance',
          }}
        >
          send a link to domino on iMessage. it will appear on the dashboard.
        </p>

        <button type="button" onClick={openDominoIMessage} style={{ ...primaryBtn(), marginTop: 20 }}>
          open iMessage
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      stepLabel={stepLabel}
      stepSwitch={
        includeSaveStep ? <StepSwitch onBack={() => setStep('save')} /> : undefined
      }
      onClose={finish}
      illustration={<DigestIllustration />}
    >
      <h2
        id="dn-onboarding-title"
        style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-serif)',
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: 'var(--ink)',
          textAlign: 'center',
        }}
      >
        weekly digest
      </h2>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 15,
          lineHeight: 1.45,
          color: 'var(--ink-2)',
          textAlign: 'center',
          textWrap: 'balance',
        }}
      >
        your best saves, emailed once a week.
      </p>

      <input
        id="dn-onboarding-email"
        aria-label="email"
        style={{
          width: '100%',
          height: 48,
          padding: '0 14px',
          borderRadius: 14,
          border: '1px solid var(--hairline)',
          background: 'var(--bg)',
          color: 'var(--ink)',
          fontSize: 16,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
        autoFocus
      />
      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--destructive, #b42318)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={saveEmail}
        disabled={!email.trim() || saving}
        style={{ ...primaryBtn(!email.trim() || saving), marginTop: 20 }}
      >
        {saving ? 'saving…' : 'continue'}
      </button>
    </ModalShell>
  );
}
