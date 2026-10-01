import { Metadata } from 'next';
import {
  LegalH2,
  LegalLink,
  LegalOperator,
  LegalShell,
} from '@gitroom/frontend/components/legal/legal-shell';

export const metadata: Metadata = {
  title: 'Terms of Service | Crea8one',
  description:
    'Terms of Service for Crea8one, a social media scheduling and insights tool.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms of Service are a contract between you and Harsh Verma, a
        sole proprietor trading as Zero Print Plus (&quot;we&quot;,
        &quot;us&quot;), for Crea8one (crea8.one).
      </p>
      <p>
        Crea8one is a social media scheduling and insights tool. You connect
        your own social accounts, schedule and publish posts, and can receive
        insights drawn from comments on accounts you connect.
      </p>
      <LegalOperator />

      <LegalH2>Using Crea8one</LegalH2>
      <p>
        You need an account, and the information you give us must be accurate.
        You are responsible for activity under your account and for keeping
        your login secure. Connecting a social account lets us access that
        account as the platform allows, so we can provide scheduling,
        publishing, and insights for accounts you connect.
      </p>

      <LegalH2>Acceptable use</LegalH2>
      <p>
        Do not use Crea8one to send spam, to publish unlawful or infringing
        content, or to break the rules of a platform you connect. You are
        responsible for following each platform&apos;s terms. We may suspend or
        end access if you misuse the service or create risk for us, for other
        people, or for a platform.
      </p>

      <LegalH2>Your content</LegalH2>
      <p>
        You own the content you upload, schedule, and publish. You grant us a
        limited, worldwide, non-exclusive license to host, store, reproduce,
        format, display, and transmit that content only to provide, secure, and
        support the service. That includes publishing it to the accounts you
        select and preparing insights you request. The license ends when the
        content is deleted from our systems, except for backup copies kept for
        up to 90 days, and except for content already published on a
        third-party platform, which stays subject to that platform&apos;s
        terms.
      </p>

      <LegalH2>AI output</LegalH2>
      <p>
        Drafts and insights may be produced by third-party AI models. AI output
        can be wrong, incomplete, or unsuitable. You are responsible for
        reviewing anything before you publish it or rely on it. We do not use
        your content or connected-account data to train AI models. Data from
        TikTok, Pinterest, X, and LinkedIn is used only to provide the service,
        is never sold, and is never used to train AI models. We do not use
        Reddit data for AI. YouTube data is used in line with the Google API
        Services User Data Policy, including Limited Use.
      </p>

      <LegalH2>Third-party platforms</LegalH2>
      <p>
        Social platforms are run by third parties. Their availability, APIs,
        and rules can change or stop. We do not control those platforms, and a
        platform may reject a post, change an API, or disconnect an account.
        If you connect YouTube, the{' '}
        <LegalLink href="https://www.youtube.com/t/terms">
          YouTube Terms of Service
        </LegalLink>{' '}
        also apply. Google&apos;s privacy practices are described in the{' '}
        <LegalLink href="https://policies.google.com/privacy">
          Google Privacy Policy
        </LegalLink>
        . You can revoke Google access at{' '}
        <LegalLink href="https://security.google.com/settings/security/permissions">
          https://security.google.com/settings/security/permissions
        </LegalLink>
        .
      </p>

      <LegalH2>Subscriptions, billing, and refunds</LegalH2>
      <p>
        Paid plans are billed by a third-party merchant of record (Paddle or
        Lemon Squeezy). That merchant is the seller of record for the payment,
        invoice, and applicable taxes. We do not store your card number. The
        price, billing period, and what a plan includes are shown at checkout.
      </p>
      <p>
        Refunds are handled by the merchant of record under its terms and under
        any mandatory consumer law that applies to you. You can cancel future
        renewal through the merchant&apos;s customer portal. Cancellation stops
        later charges. It does not, by itself, refund a period that has already
        started, unless a refund is required by law or granted by the merchant.
      </p>

      <LegalH2>Privacy and deletion</LegalH2>
      <p>
        The <LegalLink href="/privacy">Privacy Policy</LegalLink> explains how
        we handle personal information. The{' '}
        <LegalLink href="/data-deletion">Data Deletion</LegalLink> page
        explains how to ask us to delete it.
      </p>

      <LegalH2>Disclaimers</LegalH2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;.
        To the extent the law allows, we disclaim warranties of
        merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that a post will publish on time,
        that a platform will accept it, or that AI output will be accurate.
      </p>

      <LegalH2>Liability</LegalH2>
      <p>
        To the extent the law allows, our total liability arising out of the
        service in any 12-month period is limited to the amount you paid for
        Crea8one in that period. We are not liable for indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, lost
        data, or lost goodwill.
      </p>
      <p>
        Nothing in these terms limits liability that cannot be limited under
        the law, including liability for fraud, or for death or personal injury
        caused by negligence where a limit is prohibited. Mandatory consumer
        protections of your country stay in force.
      </p>

      <LegalH2>Termination</LegalH2>
      <p>
        You may stop using Crea8one at any time and ask us to delete your
        account, as described on the{' '}
        <LegalLink href="/data-deletion">Data Deletion</LegalLink> page. We may
        suspend or end access if you break these terms, if the law or a
        platform requires it, or if we discontinue the service. When access
        ends, your license to use the service ends. Sections that should
        survive, including content ownership, disclaimers, liability, and
        governing law, continue to apply.
      </p>

      <LegalH2>Source code</LegalH2>
      <p>
        Crea8one is based on software available under the GNU Affero General
        Public License. Source code is available at{' '}
        <LegalLink href="https://github.com/harshvp967/crea8-app">
          https://github.com/harshvp967/crea8-app
        </LegalLink>
        . These terms govern use of the hosted service. The AGPL governs the
        source code, as that license states.
      </p>

      <LegalH2>Changes to these terms</LegalH2>
      <p>
        We may update these terms. The &quot;Last updated&quot; date will
        change, and we will post the new terms on this page. If you keep using
        Crea8one after the update applies, the new terms apply. If you do not
        agree, stop using the service and ask us to delete your account.
      </p>

      <LegalH2>Governing law</LegalH2>
      <p>
        These terms are governed by the laws of India. Subject to mandatory
        rights you have to bring a claim in your country of residence, the
        courts at Gautam Buddha Nagar, Noida, India, have jurisdiction.
        Mandatory consumer protections of the country where you live still
        apply.
      </p>

      <LegalH2>Contact</LegalH2>
      <LegalOperator />
    </LegalShell>
  );
}
