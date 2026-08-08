'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { DominoApiError, dominoApi } from '@/features/domino/domino-api';
import { WaitlistModal } from '@/components/WaitlistModal';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';

type SignInMode = 'otp' | 'password';
type OtpStep = 'phone' | 'code' | 'setPassword';

function phoneHasMinDigits(raw: string, min = 10): boolean {
  return raw.replace(/\D/g, '').length >= min;
}

export default function DominoLoginPage() {
  const { sessionToken, isLoading, loginWithToken } = useDominoAuth();
  const router = useRouter();

  const [mode, setMode] = useState<SignInMode>('otp');
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');

  const [phone, setPhone] = useState('+1');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [signupFull, setSignupFull] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const ref = params.get('ref');
    if (ref) {
      try {
        localStorage.setItem('domino_invite_ref', ref.trim().toLowerCase());
      } catch {
        /* ignore */
      }
    }
    if (token) {
      router.replace(`/dashboard?token=${encodeURIComponent(token)}`);
    }
  }, [router]);

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

  useEffect(() => {
    let cancelled = false;
    dominoApi
      .getSignupStatus()
      .then((status) => {
        if (cancelled || !status.full) return;
        setSignupFull(true);
        setShowWaitlist(true);
      })
      .catch(() => {
        /* ignore — form still works; cap surfaces on verify */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchMode(next: SignInMode) {
    setMode(next);
    setError(null);
    setResendNotice(null);
    if (next !== 'otp') {
      setOtpStep('phone');
      setCode('');
    }
  }

  function handleSignupFull(err: unknown) {
    if (err instanceof DominoApiError && err.code === 'signup_full') {
      setError(err.message);
      setSignupFull(true);
      setShowWaitlist(true);
      return true;
    }
    return false;
  }

  async function handleOtpRequest(e: FormEvent) {
    e.preventDefault();
    if (!phoneHasMinDigits(phone) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await dominoApi.requestOtp(phone.trim());
      posthog.capture('otp_requested');
      setOtpStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpVerify(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setResendNotice(null);
    try {
      const ref = (() => {
        try {
          return localStorage.getItem('domino_invite_ref');
        } catch {
          return null;
        }
      })();
      const data = await dominoApi.verifyOtp(phone.trim(), code.trim(), ref);
      await loginWithToken(data.access_token);
      posthog.capture('otp_verified', { has_password: data.has_password });
      try {
        localStorage.removeItem('domino_invite_ref');
      } catch {
        /* ignore */
      }
      if (data.has_password) {
        router.replace('/dashboard');
        return;
      }
      setOtpStep('setPassword');
    } catch (err) {
      if (!handleSignupFull(err)) {
        setError(err instanceof Error ? err.message : 'Invalid code.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showOtpResend =
    otpStep === 'code' &&
    error !== null &&
    /expired|invalid.*code/i.test(error);

  async function handleResendOtp() {
    if (!phoneHasMinDigits(phone) || resending) return;
    setResending(true);
    setResendNotice(null);
    setError(null);
    try {
      await dominoApi.requestOtp(phone.trim());
      setCode('');
      setResendNotice('sent a new code — check iMessage.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  async function handleSetPasswordAfterOtp(e: FormEvent) {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('domino_session') : null;
    if (!token || submitting) return;
    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await dominoApi.setPassword(token, newPassword, newPasswordConfirm);
      posthog.capture('password_setup_completed');
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save password.');
    } finally {
      setSubmitting(false);
    }
  }

  function skipPasswordSetup() {
    router.replace('/dashboard');
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    if (!phoneHasMinDigits(phone) || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await dominoApi.loginWithPassword(phone.trim(), password);
      await loginWithToken(data.access_token);
      posthog.capture('password_login_completed');
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background bg-check-grid">
        <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  const inputClass =
    'min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

  const headerTitle =
    otpStep === 'code' ? 'verify code' : otpStep === 'setPassword' ? 'set a password' : 'sign in';

  const headerSubtitle =
    otpStep === 'code' || otpStep === 'setPassword'
      ? null
      : mode === 'password'
        ? 'enter the password you saved after your first sign-in.'
        : 'enter your phone — we’ll iMessage you a code.';

  return (
    <main className="min-h-dvh bg-background font-figtree lowercase text-foreground">
      <div className="mx-auto max-w-[480px] px-6 py-8 pb-24">
        <Link
          href="/"
          className="mb-6 inline-flex touch-manipulation items-center gap-1 text-sm text-muted-foreground no-underline transition-opacity hover:opacity-80"
        >
          <ChevronLeft className="size-3.5" strokeWidth={2.5} />
          back
        </Link>

        <h1
          className="mb-2 text-[clamp(1.75rem,5vw,2rem)] font-bold tracking-[-0.03em] text-foreground"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {headerTitle}
        </h1>
        {headerSubtitle ? (
          <p className="mb-6 max-w-[420px] text-[15px] leading-relaxed text-muted-foreground">{headerSubtitle}</p>
        ) : null}

        {mode === 'otp' && otpStep === 'phone' && (
          <form onSubmit={handleOtpRequest} className="mb-8 space-y-4">
            <label htmlFor="domino-phone-otp" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              phone number
            </label>
            <input
              id="domino-phone-otp"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(650) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="min-h-[52px] w-full touch-manipulation rounded-2xl text-base font-semibold"
              disabled={submitting || !phoneHasMinDigits(phone)}
            >
              {submitting ? 'sending…' : 'send code'}
            </Button>
            <button
              type="button"
              className="w-full touch-manipulation py-1 text-sm text-muted-foreground"
              onClick={() => switchMode('password')}
            >
              use password instead
            </button>
          </form>
        )}

        {mode === 'otp' && otpStep === 'code' && (
          <form onSubmit={handleOtpVerify} className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              check iMessage for your code, sent to{' '}
              <span className="font-medium text-foreground">{phone}</span>
            </p>
            <label htmlFor="domino-otp" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              6-digit code
            </label>
            <input
              id="domino-otp"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={8}
              value={code}
              onChange={(e) => {
                setResendNotice(null);
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              className={`${inputClass} text-center font-mono text-xl tracking-[0.3em]`}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {resendNotice ? <p className="text-sm text-muted-foreground">{resendNotice}</p> : null}
            {showOtpResend ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-[48px] w-full touch-manipulation sm:w-auto sm:self-start"
                disabled={resending || !phoneHasMinDigits(phone)}
                onClick={handleResendOtp}
              >
                {resending ? 'sending new code…' : 'resend code'}
              </Button>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px] flex-1 touch-manipulation"
                onClick={() => {
                  setOtpStep('phone');
                  setCode('');
                  setError(null);
                  setResendNotice(null);
                }}
              >
                back
              </Button>
              <Button
                type="submit"
                className="min-h-[52px] flex-1 touch-manipulation rounded-2xl text-base font-semibold"
                disabled={submitting || code.length < 6}
              >
                {submitting ? 'verifying…' : 'verify'}
              </Button>
            </div>
          </form>
        )}

        {mode === 'otp' && otpStep === 'setPassword' && (
          <form onSubmit={handleSetPasswordAfterOtp} className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              optional: add a password so you can sign in without a code next time.
            </p>
            <label htmlFor="domino-np1" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              new password (min 8 characters)
            </label>
            <input
              id="domino-np1"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <label htmlFor="domino-np2" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              confirm password
            </label>
            <input
              id="domino-np2"
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className={inputClass}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" className="min-h-[48px] flex-1 touch-manipulation" onClick={skipPasswordSetup}>
                skip for now
              </Button>
              <Button
                type="submit"
                className="min-h-[52px] flex-1 touch-manipulation rounded-2xl text-base font-semibold"
                disabled={submitting}
              >
                save password
              </Button>
            </div>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="mb-8 space-y-4">
            <label htmlFor="domino-phone-pw" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              phone number
            </label>
            <input
              id="domino-phone-pw"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(650) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            <label htmlFor="domino-pw" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              password
            </label>
            <input
              id="domino-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="min-h-[52px] w-full touch-manipulation rounded-2xl text-base font-semibold"
              disabled={submitting || !phoneHasMinDigits(phone) || !password}
            >
              {submitting ? 'signing in…' : 'sign in'}
            </Button>
            <button
              type="button"
              className="w-full touch-manipulation py-1 text-sm text-muted-foreground"
              onClick={() => switchMode('otp')}
            >
              use iMessage code instead
            </button>
          </form>
        )}

        {signupFull ? (
          <p className="mt-8 max-w-[420px] text-xs leading-relaxed text-muted-foreground">
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2"
              onClick={() => setShowWaitlist(true)}
            >
              join the waitlist
            </button>
          </p>
        ) : null}
      </div>

      <AnimatePresence>
        {showWaitlist && (
          <WaitlistModal
            key="waitlist"
            variant="full"
            onClose={() => setShowWaitlist(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
