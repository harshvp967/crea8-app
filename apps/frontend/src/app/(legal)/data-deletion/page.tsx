import { Metadata } from 'next';
import {
  LegalH2,
  LegalLink,
  LegalList,
  LegalOperator,
  LegalShell,
} from '@gitroom/frontend/components/legal/legal-shell';

export const metadata: Metadata = {
  title: 'Data Deletion | Crea8one',
  description:
    'How to ask Crea8one to delete your account and connected-platform data.',
};

export default function DataDeletionPage() {
  return (
    <LegalShell title="Data Deletion">
      <p>
        This page is the data deletion instructions for Crea8one (crea8.one), a
        social media scheduling and insights tool. It applies to every
        Crea8one account, including people who connected Facebook, Instagram,
        or Threads.
      </p>
      <LegalOperator />

      <LegalH2>Disconnect a channel</LegalH2>
      <p>
        Disconnecting a channel in the product removes that connection,
        including the OAuth tokens stored for it. Content already published on
        the social platform stays on that platform until you delete it there.
      </p>

      <LegalH2>Delete your account</LegalH2>
      <p>
        You can delete your account from the account settings in the product.
        Deleting the account removes the Crea8one account and the channels,
        posts, and related records we store for it.
      </p>
      <p>
        You can also email{' '}
        <LegalLink href="mailto:support@crea8.one?subject=Data%20Deletion%20Request">
          support@crea8.one
        </LegalLink>{' '}
        with the subject &quot;Data Deletion Request&quot;. Send the email from
        the address on the account, and say whether you want one channel
        removed or the whole account deleted. We may ask you to confirm that
        you control the account.
      </p>

      <LegalH2>Facebook, Instagram, and Threads</LegalH2>
      <p>
        You can remove Crea8one from Facebook settings (Settings &gt; Apps and
        Websites). That revokes Facebook&apos;s permission. To delete data we
        already stored, also disconnect the channel, delete your account, or
        email us with the subject &quot;Data Deletion Request&quot;.
      </p>
      <p>
        You can revoke Google or YouTube access at{' '}
        <LegalLink href="https://security.google.com/settings/security/permissions">
          https://security.google.com/settings/security/permissions
        </LegalLink>
        .
      </p>

      <LegalH2>What is deleted</LegalH2>
      <p>When we delete your account, we delete or de-identify:</p>
      <LegalList>
        <li>Your name, email address, and account profile.</li>
        <li>
          Connected-account OAuth tokens and stored profile or page
          information.
        </li>
        <li>Content you uploaded or scheduled that we still store.</li>
        <li>
          Comments and engagement we stored from your connected accounts for
          insights.
        </li>
        <li>Usage data tied to your account, where it is reasonable to delete it.</li>
      </LegalList>
      <p>We do not delete:</p>
      <LegalList>
        <li>
          Content already published on a third-party platform. Delete that on
          the platform.
        </li>
        <li>
          Records the merchant of record (Paddle or Lemon Squeezy) must keep
          for tax, accounting, or fraud prevention. We do not store your card
          number.
        </li>
        <li>
          Information we must keep to comply with law, resolve a dispute, or
          enforce our terms.
        </li>
      </LegalList>

      <LegalH2>Timeline</LegalH2>
      <p>
        We complete deletion within 30 days of a verified request. Backups may
        keep a copy for up to 90 days. After that, those backup copies are
        overwritten.
      </p>

      <LegalH2>Confirmation</LegalH2>
      <p>
        When we finish deleting your account, we send a confirmation email to
        the address on the account, or to the address you used for the request
        if the account email no longer exists.
      </p>

      <LegalH2>Contact</LegalH2>
      <p>
        Grievance Officer: Harsh Verma,{' '}
        <LegalLink href="mailto:support@crea8.one">support@crea8.one</LegalLink>
        .
      </p>
      <p>
        See also the <LegalLink href="/privacy">Privacy Policy</LegalLink> and
        the <LegalLink href="/terms">Terms of Service</LegalLink>.
      </p>
    </LegalShell>
  );
}
