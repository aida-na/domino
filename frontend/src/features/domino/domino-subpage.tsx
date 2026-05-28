import Link from 'next/link';
import type { ReactNode } from 'react';

export function DominoSubpage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-background bg-check-grid font-figtree lowercase text-foreground">
      <div className="mx-auto max-w-[600px] px-4 py-8 pb-24 md:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-[44px] touch-manipulation items-center text-sm font-bold text-primary"
        >
          ← back to domino
        </Link>
        <h1 className="mb-6 font-compagnon text-2xl font-bold tracking-wider text-foreground">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </main>
  );
}
