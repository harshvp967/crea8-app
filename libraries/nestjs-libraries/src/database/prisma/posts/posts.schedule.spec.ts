import {
  channelPublishDate,
  postWorkflowPlan,
  rememberValidation,
  scheduledPostState,
  scheduledPublishDate,
  siblingPostGroups,
  takeCachedValidation,
  validationCacheKey,
} from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';

describe('post scheduling', () => {
  it('queues a scheduled or immediate post and leaves an update unchanged', () => {
    expect(scheduledPostState('schedule')).toBe('QUEUE');
    expect(scheduledPostState('now')).toBe('QUEUE');
    expect(scheduledPostState('draft')).toBe('DRAFT');
    expect(scheduledPostState('update')).toBeNull();
  });

  it('keeps a chosen time and stamps an immediate post to the current minute', () => {
    expect(scheduledPublishDate('schedule', '2026-11-02T09:30:00')).toBe('2026-11-02T09:30:00');
    expect(scheduledPublishDate('now', 'ignored', new Date('2026-11-01T15:07:42.000Z'))).toBe(
      '2026-11-01T15:07:00'
    );
  });

  it('starts postWorkflow only for a queued post, stops a draft, and skips an update', () => {
    expect(postWorkflowPlan('schedule', 'QUEUE')).toBe('start');
    expect(postWorkflowPlan('now', 'QUEUE')).toBe('start');
    expect(postWorkflowPlan('draft', 'DRAFT')).toBe('stop-only');
    expect(postWorkflowPlan('update', 'QUEUE')).toBe('skip');
  });

  it('uses a channel date when one is set and the post date otherwise', () => {
    expect(
      channelPublishDate('schedule', '2026-11-02T09:30:00', '2026-11-03T11:00:00')
    ).toBe('2026-11-03T11:00:00');
    expect(channelPublishDate('schedule', '2026-11-02T09:30:00')).toBe(
      '2026-11-02T09:30:00'
    );
    expect(
      channelPublishDate(
        'now',
        '2026-11-02T09:30:00',
        '2026-11-03T11:00:00',
        new Date('2026-11-01T15:07:42.000Z')
      )
    ).toBe('2026-11-01T15:07:00');
  });

  it('keeps sibling channels that share the opened post repeat interval', () => {
    const groups = [
      [{ integrationId: 'a', intervalInDays: 1 }],
      [{ integrationId: 'b', intervalInDays: 1 }],
      [{ integrationId: 'b', intervalInDays: 1 }],
      [{ integrationId: 'c', intervalInDays: 7 }],
      [],
    ];

    expect(
      siblingPostGroups('a', 1, groups).map((group) => group[0].integrationId)
    ).toEqual(['b']);
  });

  it('reuses a schedule validation for 15 seconds and then drops it', () => {
    const key = validationCacheKey('org-cache', [{ integration: { id: 'a' } }]);
    rememberValidation(key, [{ valid: true }], 1_000);
    expect(takeCachedValidation(key, 1_000 + 15_000)).toEqual([{ valid: true }]);
    expect(takeCachedValidation(key, 1_000 + 15_001)).toBeUndefined();
    expect(validationCacheKey('org-cache', [{ integration: { id: 'b' } }])).not.toBe(key);
  });
});
