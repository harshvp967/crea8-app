jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({
    RefreshIntegrationService: class RefreshIntegrationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { ValidationPipe } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { StalkerController } from '@gitroom/backend/api/routes/stalker.controller';
import { CreateStalkerAlertRuleDto } from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import { StalkerRepository } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

const ACCOUNT_EMAIL = 'owner@example.com';
const ALERT_NAME = 'QA alert 1101';

// Same body the New alert form posts: name, enabled, and filtersToView().
// Send to is the project alert email (the account email) and is not in the body.
const newAlertBody = (sentiment: string) => ({
  projectId: 'proj',
  name: ALERT_NAME,
  enabled: true,
  filters: {
    preset: '',
    start: '',
    end: '',
    sources: '',
    engagement: '',
    from: '',
    keywordId: '',
    categoryId: '',
    sentiment,
    status: '',
    offTopic: '',
    tz: '-330',
  },
});

describe('Stalker alert create', () => {
  const previous = process.env.STALKER_ENABLED;

  beforeEach(() => {
    process.env.STALKER_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.STALKER_ENABLED = previous;
  });

  const pipe = new ValidationPipe({ transform: true });

  async function create(sentiment: string) {
    const createRule = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'rule-1',
      enabled: true,
      ...data,
    }));
    const findMany = jest.fn().mockResolvedValue([]);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'proj',
      organizationId: 'org',
      name: 'Brand',
      alertEmail: ACCOUNT_EMAIL,
      categories: [],
    });
    const unused = () => ({ model: {} });
    const repository = new StalkerRepository(
      unused() as never,
      unused() as never,
      unused() as never,
      unused() as never,
      unused() as never,
      { model: { stalkerProject: { findFirst } } } as never,
      unused() as never,
      unused() as never,
      unused() as never,
      unused() as never,
      unused() as never,
      unused() as never,
      { model: { stalkerAlertRule: { create: createRule, findMany } } } as never,
      unused() as never,
      { model: {} } as never
    );
    const service = new StalkerService(
      repository,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const controller = new StalkerController(service);
    const body = (await pipe.transform(newAlertBody(sentiment), {
      type: 'body',
      metatype: CreateStalkerAlertRuleDto,
    })) as CreateStalkerAlertRuleDto;
    const saved = await controller.createRule({ id: 'org' } as Organization, body);
    return { saved, createRule, findFirst };
  }

  it('saves QA alert 1101 for the account email', async () => {
    const { saved, createRule, findFirst } = await create('');

    expect(saved).toEqual(
      expect.objectContaining({
        name: ALERT_NAME,
        enabled: true,
        organizationId: 'org',
        projectId: 'proj',
      })
    );
    expect(saved.filters).toEqual(expect.objectContaining({ sentiment: '', status: '', offTopic: '' }));
    expect(createRule).toHaveBeenCalledWith({
      data: {
        organizationId: 'org',
        projectId: 'proj',
        name: ALERT_NAME,
        filters: expect.objectContaining({ sentiment: '' }),
      },
    });
    await expect(findFirst.mock.results[0].value).resolves.toEqual(
      expect.objectContaining({ alertEmail: ACCOUNT_EMAIL })
    );
  });

  it('saves the same alert when Sentiment is Negative', async () => {
    const { saved, createRule, findFirst } = await create('NEGATIVE');

    expect(saved.name).toBe(ALERT_NAME);
    expect(saved.filters).toEqual(expect.objectContaining({ sentiment: 'NEGATIVE' }));
    expect(createRule).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: ALERT_NAME,
        filters: expect.objectContaining({ sentiment: 'NEGATIVE', status: '', offTopic: '' }),
      }),
    });
    await expect(findFirst.mock.results[0].value).resolves.toEqual(
      expect.objectContaining({ alertEmail: ACCOUNT_EMAIL })
    );
  });
});
