import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { StalkerSourceProvider } from '@gitroom/nestjs-libraries/stalker/stalker.source';

// Placeholder for a third-party listening provider. LinkedIn has no public
// keyword search we can call with the member token used for posting.
// enabled() stays false until that provider is wired in.
export class LinkedinStalkerSource implements StalkerSourceProvider {
  id = 'linkedin' as const;
  label = 'LinkedIn';
  filter = 'LINKEDIN';

  integrationIdentifier() {
    return null;
  }

  enabled() {
    return false;
  }

  statusDetail() {
    return 'Not available yet';
  }

  async search(): Promise<StalkerMentionDraft[]> {
    return [];
  }
}
