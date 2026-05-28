'use client';

import { type FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDominoAuth } from '@/features/domino/domino-auth-context';
import { dominoApi } from '@/features/domino/domino-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SignInMode = 'otp' | 'password' | 'magic';
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
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      router.replace(`/dashboard?token=${encodeURIComponent(token)}`);
    }
  }, [router]);

  useEffect(() => {
    if (!isLoading && sessionToken) router.replace('/dashboard');
  }, [isLoading, sessionToken, router]);

  useEffect(() => {
    setError(null);
    if (mode !== 'otp') {
      setOtpStep('phone');
      setCode('');
    }
    if (mode !== 'magic') setMagicSent(false);
  }, [mode]);

  async function handleOtpRequest(e: FormEvent) {
    e.preventDefault();
    if (!phoneHasMinDigits(phone) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await dominoApi.requestOtp(phone.trim());
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
      const data = await dominoApi.verifyOtp(phone.trim(), code.trim());
      await loginWithToken(data.access_token);
      if (data.has_password) {
        router.replace('/dashboard');
        return;
      }
      setOtpStep('setPassword');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
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
      setResendNotice('sent a new code — check WhatsApp.');
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
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!phoneHasMinDigits(phone) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await dominoApi.requestMagicLink(phone.trim());
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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

  const modeTabs = (
    <div className="mb-8 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {(['otp', 'password', 'magic'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={cn(
            'min-h-[44px] flex-1 touch-manipulation rounded-lg px-2 text-center text-xs font-medium transition-colors sm:text-sm',
            mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m === 'otp' ? 'WhatsApp code' : m === 'password' ? 'Password' : 'Magic link'}
        </button>
      ))}
    </div>
  );

  return (
    <main className="min-h-dvh bg-background bg-check-grid font-figtree lowercase text-foreground">
      <div className="mx-auto max-w-[480px] px-4 py-8 pb-24 md:px-6">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="font-compagnon text-xl font-bold tracking-wider text-foreground">
            domino<span className="text-primary">.</span>
          </Link>
        </div>

        <h1 className="mb-3 text-[clamp(1.375rem,5vw,1.75rem)] font-black tracking-[-0.03em] text-foreground">
          sign in on the web
        </h1>
        <p className="mb-6 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
          use a one-time code from WhatsApp, your saved password, or a magic link—no token in the URL needed
          for code or password sign-in.
        </p>

        {modeTabs}

        {mode === 'otp' && otpStep === 'phone' && (
          <form onSubmit={handleOtpRequest} className="mb-8 space-y-4">
            <label htmlFor="domino-phone-otp" className="block text-xs font-bold tracking-wide text-muted-foreground">
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
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="min-h-[48px] w-full touch-manipulation" disabled={submitting || !phoneHasMinDigits(phone)}>
              {submitting ? 'sending…' : 'send code'}
            </Button>
          </form>
        )}

        {mode === 'otp' && otpStep === 'code' && (
          <form onSubmit={handleOtpVerify} className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              check WhatsApp for your code, sent to{' '}
              <span className="font-medium text-foreground">{phone}</span>
            </p>
            <label htmlFor="domino-otp" className="block text-xs font-bold tracking-wide text-muted-foreground">
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
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-center font-mono text-xl tracking-[0.3em] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
              <Button type="submit" className="min-h-[48px] flex-1 touch-manipulation" disabled={submitting || code.length < 6}>
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
            <label htmlFor="domino-np1" className="block text-xs font-bold tracking-wide text-muted-foreground">
              new password (min 8 characters)
            </label>
            <input
              id="domino-np1"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <label htmlFor="domino-np2" className="block text-xs font-bold tracking-wide text-muted-foreground">
              confirm password
            </label>
            <input
              id="domino-np2"
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" className="min-h-[48px] flex-1 touch-manipulation" onClick={skipPasswordSetup}>
                skip for now
              </Button>
              <Button type="submit" className="min-h-[48px] flex-1 touch-manipulation" disabled={submitting}>
                save password
              </Button>
            </div>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="mb-8 space-y-4">
            <label htmlFor="domino-phone-pw" className="block text-xs font-bold tracking-wide text-muted-foreground">
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
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <label htmlFor="domino-pw" className="block text-xs font-bold tracking-wide text-muted-foreground">
              password
            </label>
            <input
              id="domino-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="min-h-[48px] w-full touch-manipulation" disabled={submitting || !phoneHasMinDigits(phone) || !password}>
              {submitting ? 'signing in…' : 'sign in'}
            </Button>
            <p className="text-xs text-muted-foreground">
              first time? use <button type="button" className="font-semibold text-primary underline" onClick={() => setMode('otp')}>WhatsApp code</button> to sign in, then you can add a password.
            </p>
          </form>
        )}

        {mode === 'magic' && (
          <form onSubmit={handleMagicLink} className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              if this number is already on file, we&apos;ll WhatsApp you a link to open the dashboard.
            </p>
            <label htmlFor="domino-phone-magic" className="block text-xs font-bold tracking-wide text-muted-foreground">
              phone number
            </label>
            <input
              id="domino-phone-magic"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(650) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="min-h-[48px] w-full touch-manipulation" disabled={submitting || !phoneHasMinDigits(phone)}>
              {submitting ? 'sending…' : 'text me a link'}
            </Button>
            {magicSent ? (
              <p className="text-sm text-muted-foreground" role="status">
                if this number is registered, check WhatsApp for a sign-in link.
              </p>
            ) : null}
          </form>
        )}

        <p className="mt-8 max-w-[420px] text-xs leading-relaxed text-muted-foreground">
          if you need help,{' '}
          <a
            href="mailto:aidana@dailylabs.co?subject=domino%20login"
            className="font-semibold text-primary underline underline-offset-2"
          >
            email us
          </a>
          .
        </p>
      </div>
    </main>
  );
}
