import type { Metadata } from 'next';
import Link from 'next/link';
import { DominoSubpage } from '@/features/domino/domino-subpage';

export const metadata: Metadata = {
  title: 'privacy policy — domino',
  description: 'How domino handles your information.',
};

const linkClass = 'font-semibold text-[#ED4715] underline underline-offset-2';
const h2Class = 'text-base font-bold text-[#1A1208]';
const h3Class = 'text-sm font-bold text-[#1A1208]';

export default function DominoPrivacyPage() {
  return (
    <DominoSubpage title="privacy policy">
      <p className="text-xs text-[#9A9080]">effective date: july 16, 2026</p>

      <section className="space-y-3 border-b border-[#D1CDC0] pb-6">
        <h2 className={h2Class}>the short version</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="font-semibold text-[#1A1208]">what we collect:</strong> your phone number
            (that&apos;s your account) and whatever you choose to send us — links, notes, thoughts,
            screenshots.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">what we do with it:</strong> organize your
            saves, connect them to each other, and send them back to you in a weekly digest.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">what we never do:</strong> sell your data, use
            your content to train AI models, or track you across other apps.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">AI processing:</strong> your saves are processed
            by AI (currently google gemini) only to deliver domino&apos;s features — summaries, connections,
            digests. nothing more.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">how to leave:</strong> reply STOP to stop
            messages, delete saves anytime from the dashboard, or email{' '}
            <a href="mailto:hello@dailylabs.co?subject=domino%20account%20deletion" className={linkClass}>
              hello@dailylabs.co
            </a>{' '}
            to delete your account entirely.
          </li>
        </ul>
        <p>the full policy below says the same things with the legal details filled in.</p>
      </section>

      <p>
        at daily labs (&quot;domino,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), your privacy
        is a priority. this privacy policy explains how we collect, use, share, and protect personal
        information when you use our messaging service, website, web dashboard, iOS app (including the
        Safari share extension), and related features (together, the &quot;services&quot;).
      </p>
      <p>
        this policy applies to all users of domino. by using the services, you acknowledge that you have
        read and understood this policy.
      </p>

      {/* 1 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>1. information we collect</h2>
        <p>
          we collect information directly from you, automatically when you use the services, and through
          processing your saves with ai.
        </p>
        <div className="space-y-2">
          <h3 className={h3Class}>a. information you provide</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="font-semibold text-[#1A1208]">message content:</strong> when you iMessage
              domino — or save via the web dashboard or iOS app / Safari share extension — we receive what you
              send: links, notes, thoughts, screenshots, and any other content you choose to share.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">phone number:</strong> your phone number serves
              as your account identifier and is received when you message us or sign in on web or iOS.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">communications with us:</strong> any
              correspondence you send us, including support requests and feedback.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">preferences:</strong> settings such as timezone
              and digest timing.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>b. information we collect automatically</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="font-semibold text-[#1A1208]">device information:</strong> ip address, device
              type, operating system, browser type.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">usage data:</strong> logs of when you access the
              dashboard, which features you use, and general activity within the services.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">cookies and local storage:</strong> currently
              minimal — limited to essential session tokens needed for authentication on the web dashboard.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">iOS app credentials:</strong> session tokens
              are stored in the device Keychain (shared with the Safari share extension) so you stay signed
              in. we do not use advertising identifiers or App Tracking Transparency.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>c. derived information</h3>
          <p>
            we use ai to process the content you send — extracting key ideas, generating summaries, and
            building a profile of your interests (your &quot;knowledge vector&quot;). this derived information
            helps us deliver digests, surface connections across your saves, and (where you opt in) suggest
            people with similar interests.
          </p>
        </div>
        <p>
          we do not collect payment or billing information because domino is currently free. we do not collect
          data about people who are not domino users.
        </p>
      </section>

      {/* 2 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>2. how we use your information</h2>
        <p>we use personal information only for legitimate purposes, including:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="font-semibold text-[#1A1208]">provide and operate the services:</strong> saving,
            indexing, and resurfacing your content; sending confirmations and weekly digests.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">ai-powered features:</strong> we analyze the
            content you save to extract ideas, generate summaries, categorize saves, and build your knowledge
            profile. we do not use your content to train large language models.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">ai service providers:</strong> some features use
            ai provided by third-party vendors (currently google gemini). when you save content, the data
            necessary to process it may be sent to those providers. this processing is limited to delivering
            the feature and is not used to train generalized ai models.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">social features (opt-in):</strong> suggest
            connections with other users who share similar interests, only where you explicitly opt in.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">improve and customize:</strong> troubleshooting,
            analyzing usage trends, and testing new features.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">communicate with you:</strong> service updates,
            support messages, and account-related notices.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">security and compliance:</strong> detecting abuse,
            protecting the integrity of the services, and complying with legal obligations.
          </li>
        </ul>
      </section>

      {/* 3 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>3. how we share information</h2>
        <p>we share personal information only in limited circumstances:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="font-semibold text-[#1A1208]">service providers and subprocessors:</strong> we
            work with third-party companies to help operate, support, and improve the services — including
            hosting (e.g. google cloud, supabase), messaging infrastructure (blooio, for iMessage delivery),
            ai processing (e.g. google), and analytics. these providers process personal information on our
            behalf and only as instructed by us.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">legal purposes:</strong> if required by law,
            subpoena, or government request, or to protect the rights, property, or safety of daily labs, our
            users, or others.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">business transfers:</strong> in the event of a
            merger, acquisition, or asset sale, your information may be transferred to the successor entity.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">with your consent:</strong> in cases where you
            explicitly agree to share data with a third party or other users.
          </li>
        </ul>
        <p>
          we do not sell your personal information and we do not share it for cross-context behavioral
          advertising.
        </p>
      </section>

      {/* 4 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>4. data retention</h2>
        <p>
          we retain personal information only as long as necessary to provide the services, comply with legal
          obligations, and enforce agreements. your saves are retained as long as your account is active. you
          can delete individual saves through the dashboard at any time. if you request account deletion, we
          will remove your data from active systems within a reasonable timeframe, subject to legal retention
          requirements and technical constraints.
        </p>
      </section>

      {/* 5 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>5. your privacy choices and rights</h2>
        <p>you have choices about your personal information, including:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="font-semibold text-[#1A1208]">opt out of messages:</strong> reply STOP to stop
            receiving domino messages at any time.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">delete your saves:</strong> remove individual
            saves from the web dashboard or iOS app.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">access and correction:</strong> request access to
            your personal information and ask us to correct inaccuracies.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">account deletion:</strong> request deletion of
            your account and all associated data.
          </li>
          <li>
            <strong className="font-semibold text-[#1A1208]">restrictions:</strong> request that we limit or
            stop processing in certain circumstances.
          </li>
        </ul>
        <p>
          to exercise these rights, email{' '}
          <a href="mailto:hello@dailylabs.co?subject=domino%20privacy%20request" className={linkClass}>
            hello@dailylabs.co
          </a>
          .
        </p>
      </section>

      {/* 6 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>6. security measures</h2>
        <p>
          we use commercially reasonable safeguards to protect your information, including encrypted
          connections, session-based authentication, and access controls. despite these efforts, no system is
          completely secure. if we ever experience a data incident that affects you, we will notify you as
          required by law.
        </p>
      </section>

      {/* 7 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>7. international users</h2>
        <p>
          daily labs is based in the united states. by using the services, you consent to the transfer and
          processing of your data in the u.s. and potentially other jurisdictions where our providers operate.
          we apply safeguards to protect data regardless of location.
        </p>
      </section>

      {/* 8 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>8. children&apos;s privacy</h2>
        <p>
          the services are not directed at children under 13. we do not knowingly collect personal information
          from children under 13. if you believe a child under 13 has provided us with personal information,
          please contact us at{' '}
          <a href="mailto:hello@dailylabs.co?subject=children%20privacy" className={linkClass}>
            hello@dailylabs.co
          </a>{' '}
          so we can delete it.
        </p>
      </section>

      {/* 9 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>9. cookies and tracking technologies</h2>
        <p>
          at present, we do not use third-party analytics or advertising cookies. any cookies or local storage
          used are essential for core functionality — specifically, session tokens for authentication on the
          web dashboard. as we expand, we may update this section and provide options to manage preferences.
        </p>
      </section>

      {/* 10 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>10. california residents&apos; privacy rights (CCPA/CPRA)</h2>
        <p>
          if you are a resident of california, you may have rights under the california consumer privacy act
          (&quot;CCPA&quot;) as amended by the california privacy rights act (&quot;CPRA&quot;). these rights
          apply to &quot;personal information&quot; as defined by california law.
        </p>
        <div className="space-y-2">
          <h3 className={h3Class}>your rights</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="font-semibold text-[#1A1208]">right to know:</strong> request information
              about the categories of personal information we collect, the sources, purposes, and third parties
              we share it with.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to access:</strong> request a copy of the
              personal information we hold about you.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to deletion:</strong> request that we
              delete the personal information we have collected from you, subject to certain exceptions.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to correct:</strong> request that we
              correct inaccurate personal information.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to opt out of sale or sharing:</strong>{' '}
              domino does not sell your personal information or share it for cross-context behavioral
              advertising.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to limit use of sensitive information:</strong>{' '}
              domino does not use or disclose sensitive personal information for purposes beyond those permitted
              by law.
            </li>
            <li>
              <strong className="font-semibold text-[#1A1208]">right to non-discrimination:</strong> we will
              not discriminate against you for exercising your privacy rights.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>how to exercise these rights</h3>
          <p>
            email{' '}
            <a href="mailto:hello@dailylabs.co?subject=CCPA%20request" className={linkClass}>
              hello@dailylabs.co
            </a>{' '}
            with &quot;CCPA request&quot; in the subject line. we may need to verify your identity before
            responding, which could involve confirming information we already have about you. you may also
            designate an authorized agent to submit requests on your behalf.
          </p>
        </div>
      </section>

      {/* 11 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>11. changes to this policy</h2>
        <p>
          we may revise this policy from time to time. if we make material changes, we will notify you through
          the services or by other reasonable means. updates will be posted with a new effective date. your
          continued use after changes take effect constitutes acceptance.
        </p>
      </section>

      {/* 12 */}
      <section className="space-y-3 pt-4 border-t border-[#D1CDC0]">
        <h2 className={h2Class}>12. contact us</h2>
        <p>
          questions, concerns, or requests about this policy:{' '}
          <a href="mailto:hello@dailylabs.co?subject=domino%20privacy" className={linkClass}>
            hello@dailylabs.co
          </a>
        </p>
        <p className="text-xs text-[#9A9080]">daily labs · san francisco, ca</p>
      </section>

      <p className="pt-4 text-xs text-[#9A9080]">
        see also our{' '}
        <Link href="/terms" className="font-semibold text-[#5A5448] underline underline-offset-2">
          terms of service
        </Link>
        .
      </p>
    </DominoSubpage>
  );
}
