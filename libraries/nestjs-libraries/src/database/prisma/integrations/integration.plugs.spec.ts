jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({}),
  },
}));

jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({
    NotificationService: class NotificationService {},
  })
);

jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({
    RefreshIntegrationService: class RefreshIntegrationService {},
  })
);

import { BadBody } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

const plug = {
  id: 'plug-1',
  data: JSON.stringify([
    { name: 'likesAmount', value: '10' },
    { name: 'post', value: 'a follow-up offer' },
  ]),
  plugFunction: 'autoPlugPost',
  integration: { providerIdentifier: 'bluesky', id: 'int-1' },
};

function serviceWith(autoPlugPost: jest.Mock) {
  const repository = {
    getPlug: jest.fn().mockResolvedValue(plug),
  };
  const manager = {
    getSocialIntegration: jest.fn().mockReturnValue({ autoPlugPost }),
  };
  return new IntegrationService(
    repository as any,
    {} as any,
    manager as any,
    {} as any,
    {} as any,
    {} as any
  );
}

const run = {
  plugId: 'plug-1',
  postId: 'at://did:plc:test/app.bsky.feed.post/abc',
  delay: 21600000,
  totalRuns: 3,
  currentRun: 1,
};

describe('processPlugs', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('finishes the plug when the provider rejects the post permanently', async () => {
    const autoPlugPost = jest
      .fn()
      .mockRejectedValue(
        new BadBody(
          'bluesky',
          '{}',
          {} as BodyInit,
          'Bluesky post is gone, auto plug stopped: Post not found: at://did:plc:test/app.bsky.feed.post/abc'
        )
      );
    const service = serviceWith(autoPlugPost);

    await expect(service.processPlugs(run)).resolves.toBe(true);
    expect(autoPlugPost).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('Plug plug-1 stopped');
  });

  it('rethrows transient plug errors so Temporal can retry', async () => {
    const upstream = Object.assign(new Error('Upstream Failure'), {
      status: 500,
    });
    const service = serviceWith(jest.fn().mockRejectedValue(upstream));

    await expect(service.processPlugs(run)).rejects.toBe(upstream);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps a plug that has not met its condition scheduled', async () => {
    const service = serviceWith(jest.fn().mockResolvedValue(false));

    await expect(service.processPlugs(run)).resolves.toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
