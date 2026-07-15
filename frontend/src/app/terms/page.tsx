import type { Metadata } from 'next';
import Link from 'next/link';
import { DominoSubpage } from '@/features/domino/domino-subpage';

export const metadata: Metadata = {
  title: 'terms of service — domino',
  description: 'Terms of service for domino by daily labs.',
};

const linkClass = 'font-semibold text-[#ED4715] underline underline-offset-2';
const h2Class = 'text-base font-bold text-[#1A1208]';
const h3Class = 'text-sm font-bold text-[#1A1208]';

export default function DominoTermsPage() {
  return (
    <DominoSubpage title="terms of service">
      <p className="text-xs text-[#9A9080]">effective date: april 1, 2026</p>
      <p>
        these terms of service (&quot;terms&quot;) form a legally binding agreement between you and daily
        labs (&quot;domino,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). they govern your access
        to and use of domino, including our website, messaging service, web dashboard, and related features
        (collectively, the &quot;services&quot;).
      </p>
      <p>
        by messaging our number or accessing the services, you agree to be bound by these terms and our{' '}
        <Link href="/privacy" className={linkClass}>
          privacy policy
        </Link>
        . if you do not agree, do not use the services.
      </p>

      {/* 1 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>1. eligibility</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>1.1 minimum age</h3>
          <p>you must be at least 13 years old to use the services. by using them, you represent that you meet this requirement.</p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>1.2 legal capacity</h3>
          <p>
            you must have the legal capacity to enter into a binding contract. if you are under the age of
            majority in your jurisdiction, you may only use the services with the involvement of a parent or
            guardian who agrees to these terms.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>1.3 compliance with laws</h3>
          <p>
            you are responsible for ensuring your use of the services complies with all laws, rules, and
            regulations that apply to you.
          </p>
        </div>
      </section>

      {/* 2 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>2. the services</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>2.1 overview</h3>
          <p>
            domino is a messaging-based service that lets you save links, notes, and ideas by texting them to
            our number (imessage / sms). we index your saves, extract key ideas, send you periodic digests, and — over
            time — help you discover connections across what you&apos;ve saved and find people thinking about
            similar topics.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>2.2 messaging &amp; consent</h3>
          <p>
            by messaging domino, you consent to receive service-related messages at the number you use,
            including confirmations, digests, and feature updates. message and data rates from your carrier may
            apply. you can opt out at any time by replying STOP.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>2.3 third-party services</h3>
          <p>
            the services integrate with third-party messaging platforms (such as imessage / sms via blooio) and use third-party providers
            for hosting, AI processing, and other functions. when you use the services, your data may be
            processed by these providers solely to deliver the requested functionality.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>2.4 service changes</h3>
          <p>
            domino is an evolving product. we may improve, change, or discontinue features at any time. we will
            make reasonable efforts to notify you of material changes, but we are not obligated to maintain any
            particular feature.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>2.5 no guarantee of availability</h3>
          <p>
            we do not guarantee that the services will always be available, uninterrupted, or error-free.
            downtime may occur for maintenance, technical issues, or reasons outside our control.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>2.6 ai-powered features</h3>
          <p>
            some features use artificial intelligence to extract ideas, generate summaries, and suggest
            connections. these outputs may be incomplete, inaccurate, or unexpected. you are responsible for
            reviewing any ai-generated output before relying on it. your content is not used to train
            generalized ai models.
          </p>
        </div>
      </section>

      {/* 3 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>3. accounts</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>3.1 account creation</h3>
          <p>
            your account is created automatically when you first message domino. your phone number serves as
            your identity. there is no separate sign-up form.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>3.2 security</h3>
          <p>
            we authenticate you through your phone number and session-based magic links. you are responsible
            for keeping your device secure. we are not liable for unauthorized access that results from your
            failure to safeguard your device or credentials.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>3.3 responsibility for activity</h3>
          <p>you are solely responsible for all actions taken under your account, whether or not authorized by you.</p>
        </div>
      </section>

      {/* 4 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>4. your content</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>4.1 ownership</h3>
          <p>
            you retain ownership of the links, notes, ideas, and other content (&quot;user content&quot;) you
            send to or store through the services.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>4.2 license to daily labs</h3>
          <p>
            by using the services, you grant daily labs a worldwide, non-exclusive, royalty-free license to
            host, store, process, and display your user content solely for the purpose of operating, providing,
            and improving the services. this includes extracting ideas, generating summaries, building your
            knowledge profile, and (where you opt in) suggesting connections with other users.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>4.3 limitations</h3>
          <p>we do not sell your data to advertisers. we do not use your user content to train large language models.</p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>4.4 responsibility</h3>
          <p>you are solely responsible for your user content, including ensuring it does not violate any laws or infringe rights.</p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>4.5 deletion</h3>
          <p>
            you can delete individual saves through the dashboard. if you request account deletion, we will
            make reasonable efforts to remove your data from active systems, subject to applicable laws and
            data-retention obligations.
          </p>
        </div>
      </section>

      {/* 5 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>5. acceptable use</h2>
        <p>you agree not to use the services in any way that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>violates applicable law or regulation.</li>
          <li>infringes or misappropriates intellectual property or other rights.</li>
          <li>transmits defamatory, harassing, abusive, or fraudulent content.</li>
          <li>sends spam or unsolicited communications through the service.</li>
          <li>distributes malware, viruses, or harmful code.</li>
          <li>attempts to gain unauthorized access to the services, accounts, or systems.</li>
          <li>reverse engineers, decompiles, or attempts to derive source code.</li>
          <li>interferes with or disrupts the performance or integrity of the services.</li>
        </ul>
        <p>
          we reserve the right to investigate violations and take appropriate action, including suspending or
          terminating accounts or reporting illegal activity to authorities.
        </p>
      </section>

      {/* 6 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>6. intellectual property</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>6.1 our rights</h3>
          <p>
            the services, including all software, technology, designs, and content provided by daily labs, are
            the exclusive property of daily labs and its licensors.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>6.2 limited license</h3>
          <p>
            subject to these terms, we grant you a limited, non-exclusive, non-transferable license to access
            and use the services for personal purposes.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>6.3 feedback</h3>
          <p>
            if you provide feedback or suggestions about the services, you grant daily labs a perpetual,
            irrevocable, worldwide, royalty-free license to use that feedback for any purpose without obligation
            to you.
          </p>
        </div>
      </section>

      {/* 7 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>7. privacy</h2>
        <p>
          your use of the services is subject to our{' '}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>
          , which describes how we collect, use, and safeguard your information. by using the services, you
          acknowledge and agree that we may process your information as described there.
        </p>
      </section>

      {/* 8 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>8. termination</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>8.1 by us</h3>
          <p>
            we may suspend or terminate your account if we reasonably believe you have violated these terms,
            your use poses a risk to others, we are required to do so by law, or we discontinue the services.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>8.2 by you</h3>
          <p>
            you may stop using the services at any time by replying STOP to opt out of messages. to request
            full account deletion,{' '}
            <a href="mailto:aidana@dailylabs.co?subject=domino%20account%20deletion" className={linkClass}>
              email us
            </a>
            .
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>8.3 effect of termination</h3>
          <p>
            when your account is terminated, your right to use the services ceases immediately. we may delete
            your account and associated data, subject to our data-retention practices. certain provisions
            (including disclaimers, limitations of liability, and dispute resolution) survive termination.
          </p>
        </div>
      </section>

      {/* 9 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>9. disclaimer of warranties</h2>
        <p>
          the services are provided on an &quot;as is&quot; and &quot;as available&quot; basis, without
          warranties of any kind, express or implied, including merchantability, fitness for a particular
          purpose, and non-infringement. we do not warrant that the services will be uninterrupted, secure,
          or error-free, or that any content or output will be accurate or reliable.
        </p>
      </section>

      {/* 10 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>10. limitation of liability</h2>
        <p>
          to the maximum extent permitted by law, daily labs and its affiliates, officers, employees, and
          agents will not be liable for any indirect, incidental, special, consequential, or punitive damages,
          or any loss of profits, revenue, goodwill, or data. our total liability for all claims related to the
          services will not exceed $100 or the amount you paid to daily labs in the 12 months preceding the
          claim, whichever is greater.
        </p>
      </section>

      {/* 11 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>11. indemnification</h2>
        <p>
          you agree to indemnify and hold harmless daily labs, its affiliates, officers, employees, and agents
          from any claims, liabilities, damages, losses, and expenses arising out of your use of the services,
          your user content, or your violation of these terms or applicable law.
        </p>
      </section>

      {/* 12 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>12. dispute resolution</h2>
        <div className="space-y-2">
          <h3 className={h3Class}>12.1 informal resolution</h3>
          <p>
            before filing a formal claim, you agree to{' '}
            <a href="mailto:aidana@dailylabs.co?subject=domino%20dispute" className={linkClass}>
              email us
            </a>{' '}
            to attempt to resolve the dispute informally.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>12.2 binding arbitration</h3>
          <p>
            if we cannot resolve the dispute informally within 30 days, you and daily labs agree to resolve all
            disputes through binding arbitration administered by the american arbitration association (AAA)
            under its consumer arbitration rules. you waive your right to a jury trial and to participate in
            class actions.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>12.3 class action waiver</h3>
          <p>
            you and daily labs agree that each may bring claims against the other only in your individual
            capacity, not as a plaintiff or class member in any purported class, collective, or representative
            action.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className={h3Class}>12.4 opt-out</h3>
          <p>
            you may opt out of arbitration within 30 days of first accepting these terms by{' '}
            <a href="mailto:aidana@dailylabs.co?subject=arbitration%20opt-out" className={linkClass}>
              emailing us
            </a>{' '}
            with the subject &quot;arbitration opt-out.&quot;
          </p>
        </div>
      </section>

      {/* 13 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>13. governing law</h2>
        <p>
          these terms are governed by the laws of the state of delaware, without regard to conflict-of-laws
          principles. any legal proceedings must be brought in the state or federal courts located in
          california, and you consent to the personal jurisdiction of those courts.
        </p>
      </section>

      {/* 14 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>14. changes to these terms</h2>
        <p>
          we may update these terms from time to time. if we make material changes, we will notify you through
          the services or by other reasonable means. by continuing to use the services after changes take
          effect, you agree to the revised terms. if you do not agree, stop using the services.
        </p>
      </section>

      {/* 15 */}
      <section className="space-y-3 pt-4">
        <h2 className={h2Class}>15. miscellaneous</h2>
        <p>
          these terms, together with our{' '}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>
          , constitute the entire agreement between you and daily labs regarding the services. if any provision
          is found unenforceable, the remaining provisions remain in effect. our failure to enforce any right
          does not constitute a waiver. you may not assign these terms without our consent; we may assign them
          without restriction.
        </p>
      </section>

      {/* 16 */}
      <section className="space-y-3 pt-4 border-t border-[#D1CDC0]">
        <h2 className={h2Class}>16. contact us</h2>
        <p>
          questions about these terms:{' '}
          <a href="mailto:aidana@dailylabs.co?subject=domino%20terms" className={linkClass}>
            email us
          </a>
        </p>
        <p className="text-xs text-[#9A9080]">daily labs · san francisco, ca</p>
      </section>

      <p className="pt-4 text-xs text-[#9A9080]">
        see also our{' '}
        <Link href="/privacy" className="font-semibold text-[#5A5448] underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </DominoSubpage>
  );
}
