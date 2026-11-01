jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/refresh.integration.service', () => ({
  RefreshIntegrationService: class RefreshIntegrationService {},
}));
jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

function build(webhooks?: { emitAll: jest.Mock }) {
  const repository = {
    insertMentions: jest.fn().mockResolvedValue(1),
    mentionsCreatedSince: jest.fn().mockResolvedValue([{ id: 'mention-1', text: 'crea8' }]),
  };
  const constructed = new StalkerService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    webhooks as never
  );
  return { service: constructed, repository };
}

describe('Stalker workspace match webhooks', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts stalker.match for a new mention and leaves the project webhook URL alone', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const webhooks = { emitAll: jest.fn().mockResolvedValue(undefined) };
    const { service, repository } = build(webhooks);

    const saved = await (service as unknown as {
      storeMentions: (...args: unknown[]) => Promise<{ stored: number }>;
    }).storeMentions('org-1', { id: 'proj-1', webhookUrl: '' }, null, [{ externalId: 'ext-1' }], new Map());

    expect(saved).toEqual({ stored: 1, duplicates: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repository.mentionsCreatedSince).toHaveBeenCalledTimes(1);
    expect(webhooks.emitAll).toHaveBeenCalledWith('org-1', 'stalker.match', [
      {
        event: 'stalker.match',
        projectId: 'proj-1',
        mention: { id: 'mention-1', text: 'crea8' },
      },
    ]);
  });

  it('does not call workspace delivery when no webhook service is wired', async () => {
    const { service, repository } = build();
    await (service as unknown as {
      storeMentions: (...args: unknown[]) => Promise<unknown>;
    }).storeMentions('org-1', { id: 'proj-1', webhookUrl: '' }, null, [{ externalId: 'ext-1' }], new Map());
    expect(repository.mentionsCreatedSince).not.toHaveBeenCalled();
  });
});
