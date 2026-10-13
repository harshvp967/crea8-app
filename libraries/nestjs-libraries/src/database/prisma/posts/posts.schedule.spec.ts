import {
  postWorkflowPlan,
  scheduledPostState,
  scheduledPublishDate,
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
});
