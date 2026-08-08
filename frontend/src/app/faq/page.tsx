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
          save links, notes, and ideas by texting them to domino. we organize what you send, connect it to
          what you&apos;ve saved before, and send you a weekly digest so nothing gets lost.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i get started?</h2>
        <p>
          sign in at{' '}
          <Link href="/login" className="font-semibold text-[#ED4715] underline underline-offset-2">
            domino.fyi/login
          </Link>{' '}
          with an iMessage code, or text our number. we open a few new seats each day — if we&apos;re full,
          join the waitlist and try tomorrow.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">do i need the app?</h2>
        <p>
          no. saving works over iMessage alone. the app adds browsing, search, chat with your saves, and a
          Safari share extension.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">what about privacy?</h2>
        <p>
          your saves are yours. we don&apos;t sell your data or use it to train AI models. social features
          are opt-in. details:{' '}
          <Link href="/privacy" className="font-semibold text-[#ED4715] underline underline-offset-2">
            domino.fyi/privacy
          </Link>
          .
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i stop messages?</h2>
        <p>reply STOP anytime.</p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">support?</h2>
        <p>
          email{' '}
          <a
            href="mailto:hello@dailylabs.co?subject=domino%20support"
            className="font-semibold text-[#ED4715] underline underline-offset-2"
          >
            hello@dailylabs.co
          </a>
          .
        </p>
      </section>
    </DominoSubpage>
  );
}
