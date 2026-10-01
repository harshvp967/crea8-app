import { Metadata } from 'next';
import {
  LegalH2,
  LegalH3,
  LegalLink,
  LegalList,
  LegalOperator,
  LegalShell,
} from '@gitroom/frontend/components/legal/legal-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy | Crea8one',
  description:
    'Privacy Policy for Crea8one, a social media scheduling and insights tool.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how Crea8one (crea8.one), a social media
        scheduling and insights tool, handles personal information. You connect
        your own social accounts, schedule and publish posts, and can receive
        insights drawn from comments on accounts you connect.
      </p>
      <p>
        Crea8one is offered to people in India, the United States, the European
        Union, the United Kingdom, and the rest of the world.
      </p>

      <LegalH2>Who we are</LegalH2>
      <p>The operator of Crea8one is:</p>
      <LegalOperator />

      <LegalH2>Information we process</LegalH2>
      <LegalList>
        <li>Account information, such as your name and email address.</li>
        <li>
          Connected-platform OAuth tokens, and profile or page information for
          the accounts you choose to connect.
        </li>
        <li>Content you upload or schedule.</li>
        <li>
          Comments and engagement on your own connected accounts, used to
          produce insights for you.
        </li>
        <li>
          Usage and log data, such as IP address, browser type, device
          information, and timestamps, used to run and protect the service.
        </li>
        <li>
          Cookies: essential cookies that keep the service working, and
          analytics cookies that help us understand how it is used.
        </li>
        <li>
          Payment information is handled by a third-party merchant of record
          (Paddle or Lemon Squeezy). We do not store your card number or full
          payment card details. The merchant shares limited billing details
          with us, such as plan and subscription status.
        </li>
      </LegalList>

      <LegalH2>How we use information</LegalH2>
      <p>We use personal information to:</p>
      <LegalList>
        <li>Provide, maintain, and secure the service you request.</li>
        <li>
          Connect the social accounts you authorize, publish content you ask us
          to publish, and prepare insights from comments on those accounts.
        </li>
        <li>Provide support and meet legal duties.</li>
        <li>
          Understand product usage through analytics, and bill subscriptions
          through the merchant of record.
        </li>
      </LegalList>
      <p>
        We use data from connected platforms only to provide the service. We do
        not sell that data, and we do not use it to train AI models.
      </p>

      <LegalH2>Connected platforms</LegalH2>
      <LegalH3>YouTube and Google</LegalH3>
      <p>
        If you connect YouTube, Crea8one&apos;s use of information received from
        Google APIs complies with the{' '}
        <LegalLink href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </LegalLink>
        , including the Limited Use requirements.
      </p>
      <p>
        YouTube features you use through Crea8one are also covered by the{' '}
        <LegalLink href="https://www.youtube.com/t/terms">
          YouTube Terms of Service
        </LegalLink>{' '}
        and the{' '}
        <LegalLink href="https://policies.google.com/privacy">
          Google Privacy Policy
        </LegalLink>
        . You can revoke Crea8one&apos;s access to your Google account at any
        time at{' '}
        <LegalLink href="https://security.google.com/settings/security/permissions">
          https://security.google.com/settings/security/permissions
        </LegalLink>
        .
      </p>
      <LegalH3>Meta (Facebook, Instagram, and Threads)</LegalH3>
      <p>
        If you connect Facebook, Instagram, or Threads, we use the data Meta
        provides only to provide Crea8one to you, including scheduling,
        publishing, and insights on accounts you connect. We do not sell this
        data, and we do not use it to train AI models. How to ask us to delete
        it is described on the{' '}
        <LegalLink href="/data-deletion">Data Deletion</LegalLink> page. You
        can also remove Crea8one from Facebook under Settings &gt; Apps and
        Websites.
      </p>
      <LegalH3>TikTok, Pinterest, X, and LinkedIn</LegalH3>
      <p>
        Data from TikTok, Pinterest, X, and LinkedIn is used only to provide
        the service. It is never sold and never used to train AI models.
      </p>
      <LegalH3>Reddit</LegalH3>
      <p>We do not use Reddit data for AI.</p>

      <LegalH2>India (DPDP Act 2023)</LegalH2>
      <p>
        Where India&apos;s Digital Personal Data Protection Act, 2023 applies,
        we process personal data for lawful purposes, including providing the
        service you request, meeting legal duties, and, where the law requires
        it, with your consent. You may ask to access, correct, or erase your
        personal data, and you may nominate another person to exercise your
        rights, by emailing support@crea8.one. Where processing is based on
        consent, you may withdraw that consent. You may contact the Grievance
        Officer named above, and you may complain to the Data Protection Board
        of India.
      </p>

      <LegalH2>European Union and United Kingdom</LegalH2>
      <p>
        Where the GDPR or UK GDPR applies, we rely on these lawful bases:
      </p>
      <LegalList>
        <li>
          Contract: to provide the account, scheduling, publishing, and
          insights you sign up for.
        </li>
        <li>
          Legitimate interests: to keep the service secure, prevent abuse, and
          understand how it is used, where those interests are not overridden
          by your rights.
        </li>
        <li>
          Consent: for analytics cookies where consent is required, and for any
          other processing that needs consent. You can withdraw consent at any
          time.
        </li>
        <li>Legal obligation: where the law requires us to keep or share information.</li>
      </LegalList>
      <p>
        You can ask for access, correction, erasure, restriction, or a copy of
        your personal data, and you can object to processing based on
        legitimate interests. Insights are prepared for you to review. They
        are not decisions that produce legal effects about you. You may lodge
        a complaint with your local supervisory authority, or with the UK
        Information Commissioner&apos;s Office if you are in the United
        Kingdom.
      </p>
      <p>
        We are based in India. Service providers may process personal data in
        other countries, including the United States. Where the GDPR or UK GDPR
        requires a transfer tool, we use Standard Contractual Clauses (and the
        UK Addendum or the International Data Transfer Agreement where UK GDPR
        applies).
      </p>

      <LegalH2>California (CCPA / CPRA)</LegalH2>
      <p>This section applies to California residents.</p>
      <p>Categories of personal information we collect:</p>
      <LegalList>
        <li>Identifiers, such as name, email address, and account ID.</li>
        <li>
          Commercial information, such as subscription status received from the
          merchant of record.
        </li>
        <li>Internet or network activity, such as usage and log data.</li>
        <li>
          Information you choose to give us about a business or organization.
        </li>
        <li>
          Content you upload, and insights drawn from comments on your own
          connected accounts.
        </li>
      </LegalList>
      <p>
        We do not sell or share personal information. We do not sell or share
        personal information of anyone under 16.
      </p>
      <p>
        You have the right to know, delete, and correct personal information,
        and the right to opt out of sale or sharing. You will not receive
        discriminatory treatment for exercising these rights. Email
        support@crea8.one with the subject &quot;California privacy
        request&quot;. We will verify the request using the email address on
        your account. An authorized agent may submit a request for you. We may
        ask for proof that you authorized the agent.
      </p>

      <LegalH2>Cookies</LegalH2>
      <p>
        Essential cookies keep you signed in and remember basic preferences.
        Analytics cookies help us see which parts of the service are used. You
        can control cookies in your browser. Blocking essential cookies may
        stop the service from working.
      </p>

      <LegalH2>Sub-processors</LegalH2>
      <p>
        We use service providers that process personal information for us, for
        example:
      </p>
      <LegalList>
        <li>Hosting, such as Railway and Vercel.</li>
        <li>Storage for content you upload.</li>
        <li>Email, such as Resend.</li>
        <li>
          AI providers (for example, OpenAI) that generate drafts and insights.
        </li>
        <li>The payment processor and merchant of record.</li>
        <li>Analytics providers.</li>
      </LegalList>
      <p>
        These providers may use personal information only to perform services
        for us, and they must protect it.
      </p>

      <LegalH2>How long we keep information</LegalH2>
      <p>
        We keep account and content data while your account is open. After you
        delete your account, or after we verify a deletion request, we delete
        or de-identify personal information within 30 days, except where we
        must keep it longer for legal, security, or accounting reasons. Backups
        may retain copies for up to 90 days. The merchant of record may keep
        payment records as tax and accounting law requires. See{' '}
        <LegalLink href="/data-deletion">Data Deletion</LegalLink> for how to
        ask.
      </p>

      <LegalH2>Security</LegalH2>
      <p>
        We use access controls and encrypted connections that fit the service.
        No method of storage or transmission is completely secure.
      </p>

      <LegalH2>Children</LegalH2>
      <p>
        Crea8one is not directed at children under 18, and we do not knowingly
        collect personal information from children.
      </p>

      <LegalH2>Changes</LegalH2>
      <p>
        We may update this policy. The &quot;Last updated&quot; date at the top
        will change. If a change materially affects how we use personal
        information, we will post the update on this page.
      </p>

      <LegalH2>Contact</LegalH2>
      <LegalOperator />
      <p>
        The <LegalLink href="/terms">Terms of Service</LegalLink> explain the
        rules for using Crea8one.
      </p>
    </LegalShell>
  );
}
