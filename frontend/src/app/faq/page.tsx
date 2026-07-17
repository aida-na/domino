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
          domino is an iMessage-first way to save links, notes, and ideas. we index what you send, resurface
          it on a rhythm that works for you, and (over time) help you see patterns across what you care
          about.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i get started?</h2>
        <p>
          head to{' '}
          <Link href="/login" className="font-semibold text-[#ED4715] underline underline-offset-2">
            login
          </Link>{' '}
          and sign in with an iMessage code — or text our number from the home page. we only open a
          few new seats each day; if we&apos;re full, join the waitlist and try tomorrow.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">do i need to install an app?</h2>
        <p>
          no — capture still works over iMessage if you can message. the optional{' '}
          <strong className="font-semibold text-[#1A1208]">domino iOS app</strong> is for browsing,
          searching, and chatting with what you&apos;ve saved, plus a Safari share extension to save
          links without leaving the page.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how does the iOS app work?</h2>
        <p>
          sign in with the same phone number you use for iMessage (one-time code, or an optional
          password after your first sign-in). we only open a few new seats each day — if we&apos;re
          full, join the waitlist. your saves sync with the web dashboard. from Safari, use Share →
          &quot;save to domino&quot; after you&apos;ve signed into the app once.
        </p>
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
        <h2 className="text-base font-bold text-[#1A1208]">how do i get support?</h2>
        <p>
          email{' '}
          <a
            href="mailto:aidana@dailylabs.co?subject=domino%20support"
            className="font-semibold text-[#ED4715] underline underline-offset-2"
          >
            aidana@dailylabs.co
          </a>{' '}
          or reply to any domino iMessage. this faq page (
          <Link href="/faq" className="font-semibold text-[#ED4715] underline underline-offset-2">
            domino.fyi/faq
          </Link>
          ) is also our App Store support URL.
        </p>
      </section>
      <section className="space-y-2 pt-2">
        <h2 className="text-base font-bold text-[#1A1208]">how do i stop messages?</h2>
        <p>reply STOP to unsubscribe from domino messages at any time.</p>
      </section>
    </DominoSubpage>
  );
}
