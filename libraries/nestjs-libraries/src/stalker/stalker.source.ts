import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export type StalkerSourceId = 'youtube' | 'reddit' | 'x' | 'linkedin';

export type StalkerSourceAuth = {
  accessToken?: string;
};

export type StalkerSearchTerms = {
  phrases: string[];
  handle?: string;
  subreddit?: string;
};

// Keyword listening. Comment ingestion stays on the connected social provider.
export interface StalkerSourceProvider {
  id: StalkerSourceId;
  label: string;
  // Mention filter chip. A platform can cover more than one StalkerSource value.
  filter: string;
  // Connected-account identifier this source needs, or null when it uses env credentials.
  integrationIdentifier(): string | null;
  // Keyword search can run on platform env credentials, with no connected account.
  searchesWithoutAccount?(): boolean;
  enabled(auth?: StalkerSourceAuth): boolean;
  statusDetail(available: boolean): string;
  buildQuery(input: StalkerSearchTerms): string;
  search(
    keyword: string,
    since: Date,
    auth?: StalkerSourceAuth
  ): Promise<StalkerMentionDraft[]>;
}
