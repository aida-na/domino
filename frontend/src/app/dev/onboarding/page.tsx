'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DominoOnboardingSheet } from '@/features/domino/domino-onboarding';

function OnboardingPreview() {
  const params = useSearchParams();
  const step = params.get('step') === 'email' ? 'email' : 'save';
  const [done, setDone] = useState(false);

  const sheet = useMemo(
    () => (
      <DominoOnboardingSheet
        token="preview"
        hasItems={false}
        hasEmail={false}
        initialEmail=""
        initialStep={step}
        onComplete={() => setDone(true)}
      />
    ),
    [step],
  );

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--ink)',
        position: 'relative',
      }}
      className="bg-check-grid"
    >
      <div style={{ padding: 28, opacity: 0.5 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700 }}>domino</div>
        <p style={{ color: 'var(--ink-3)', fontSize: 15, maxWidth: 280 }}>
          dashboard behind the modal… preview step={step}
          {done ? ' · dismissed' : ''}
        </p>
      </div>
      {!done && sheet}
    </main>
  );
}

/** Local-only preview — open /dev/onboarding?step=save|email */
export default function OnboardingPreviewPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPreview />
    </Suspense>
  );
}
