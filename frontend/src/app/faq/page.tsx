import type { Metadata } from 'next';
import Link from 'next/link';
import { DominoSubpage } from '@/features/domino/domino-subpage';

export const metadata: Metadata = {
  title: 'faq — domino',
  description: 'Frequently asked questions about domino.',
};

export default function DominoFaqPage() {
  return (
    <DominoSubpage title="faq">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1A1208]">what is domino?</h2>
        <p>
          domino is a text-first way to save links, notes, and ideas. we index what you send, resurface
          it on a rhythm that works for you, and (over time) help you see patterns across what you care
          about.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i get started?</h2>
        <p>
          message our number from the{' '}
          <Link href="/" className="font-semibold text-[#ED4715] underline underline-offset-2">
            domino home page
          </Link>
          . say hi — we&apos;ll walk you through the rest.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">do i need to install an app?</h2>
        <p>nope. domino works through messaging. if you can text, you can use domino.</p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">what about privacy?</h2>
        <p>
          your inbox is yours. optional features (like matching you with people on similar topics) are
          opt-in. see our{' '}
          <Link href="/privacy" className="font-semibold text-[#ED4715] underline underline-offset-2">
            privacy page
          </Link>{' '}
          for details.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i stop messages?</h2>
        <p>reply STOP to unsubscribe from domino messages at any time.</p>
      </section>
    </DominoSubpage>
  );
}
