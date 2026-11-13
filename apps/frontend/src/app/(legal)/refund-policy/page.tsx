import { legalPageMetadata } from '@gitroom/frontend/components/layout/site.metadata';
import { LegalShell } from '@gitroom/frontend/components/legal/legal-shell';

export const metadata = legalPageMetadata('Refunds', '/refund-policy');

export default function RefundPolicyPage() {
  return (
    <LegalShell title="Refunds" updated="November 13, 2026">
      <p>
        Questions about a charge can be sent to support@crea8.one. Include the
        email on the account and the date of the charge.
      </p>
    </LegalShell>
  );
}
