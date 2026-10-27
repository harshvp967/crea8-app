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

import { NotFoundException } from '@nestjs/common';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

const project = { id: 'proj', organizationId: 'org-a' };

const serviceFor = (repository: Record<string, jest.Mock>) =>
  new StalkerService(
    repository as never,
    {
      getSocialIntegration: () => ({ refreshCron: false }),
      stalkerCommentSources: (): unknown[] => [],
    } as never,
    { all: (): unknown[] => [] } as never,
    { hasApiKey: () => false } as never,
    {} as never,
    { refresh: jest.fn(), startRefreshWorkflow: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never
  );

describe('Stalker scan load and mentions', () => {
  const previous = process.env.STALKER_ENABLED;

  beforeEach(() => {
    process.env.STALKER_ENABLED = 'true';
    process.env.STALKER_SCAN_CACHE_SECONDS = '20';
  });

  afterAll(() => {
    process.env.STALKER_ENABLED = previous;
    delete process.env.STALKER_SCAN_CACHE_SECONDS;
  });

  const repository = () => ({
    getProject: jest.fn(async (organizationId: string, projectId: string) =>
      organizationId === project.organizationId && projectId === project.id ? project : null
    ),
    latestScan: jest.fn().mockResolvedValue({
      id: 'run-1',
      status: 'succeeded',
      trigger: 'manual',
      startedAt: new Date('2026-10-13T10:00:00.000Z'),
      finishedAt: new Date('2026-10-13T10:01:00.000Z'),
      error: '',
      result: { sources: [{ id: 'youtube', error: '' }], totals: { found: 2 } },
    }),
    listMentions: jest.fn().mockResolvedValue({ mentions: [{ id: 'm1' }], total: 1 }),
    activeScan: jest.fn().mockResolvedValue(null),
    latestManualScan: jest.fn().mockResolvedValue(null),
    createScanRun: jest.fn().mockResolvedValue({ id: 'run-2' }),
    finishScanRun: jest.fn().mockResolvedValue({ count: 1 }),
  });

  it('loads a finished scan from cache on the second read, scoped to the organization', async () => {
    const repo = repository();
    const service = serviceFor(repo);
    const first = await service.latestScan('org-a', 'proj');
    const second = await service.latestScan('org-a', 'proj');
    expect(first.runId).toBe('run-1');
    expect(second).toEqual(first);
    expect(repo.latestScan).toHaveBeenCalledTimes(1);
    const raw = await ioRedis.get('stalker:scan:org-a:proj');
    expect(raw).toContain('run-1');
    expect(await ioRedis.get('stalker:scan:org-b:proj')).toBeUndefined();
    await ioRedis.del('stalker:scan:org-a:proj');
  });

  it('drops the cached scan when a new one is requested', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const repo = repository();
    const service = serviceFor(repo);
    await service.latestScan('org-a', 'proj');
    repo.latestScan.mockResolvedValue({
      id: 'run-2',
      status: 'queued',
      trigger: 'manual',
      startedAt: new Date('2026-10-13T10:05:00.000Z'),
      finishedAt: null,
      error: '',
      result: null,
    });
    await service.requestScan('org-a', 'proj', 'manual');
    const loaded = await service.latestScan('org-a', 'proj');
    expect(loaded.runId).toBe('run-2');
    expect(loaded.status).toBe('queued');
    expect(repo.latestScan).toHaveBeenCalledTimes(2);
    await ioRedis.del('stalker:scan:org-a:proj');
  });

  it('lists mentions only inside the organization project', async () => {
    const repo = repository();
    const service = serviceFor(repo);
    await expect(service.mentions('org-a', { projectId: 'proj' } as never)).resolves.toEqual({
      mentions: [{ id: 'm1' }],
      total: 1,
    });
    expect(repo.listMentions).toHaveBeenCalledWith('org-a', { projectId: 'proj' });
    await expect(service.mentions('org-b', { projectId: 'proj' } as never)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
