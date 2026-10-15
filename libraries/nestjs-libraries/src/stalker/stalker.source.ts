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

// Passed into every source. A source uses the fields it understands.
export type StalkerSearchScope = {
  projectId?: string;
  phraseKey?: string;
  backfill?: boolean;
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
  // Non-empty salt keeps this source's search cache per project. Empty uses
  // the shared phrase cache (YouTube quota is spent once per phrase).
  cacheNamespace?(scope: StalkerSearchScope): string;
  search(
    keyword: string,
    since: Date,
    auth?: StalkerSourceAuth,
    scope?: StalkerSearchScope
  ): Promise<StalkerMentionDraft[]>;
}
