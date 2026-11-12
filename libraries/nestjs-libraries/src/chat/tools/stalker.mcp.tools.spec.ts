import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, HttpException } from '@nestjs/common';
import {
  keywordUpgradeMessage,
  manualCheckMessage,
  mentionHistoryMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service',
  () => ({
    StalkerService: class StalkerService {},
    isStalkerEnabled: () => process.env.STALKER_ENABLED === 'true',
  })
);

import { StalkerProjectsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.projects.tool';
import { StalkerMentionsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.mentions.tool';
import { StalkerKeywordsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.keywords.tool';
import { StalkerAlertsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.alerts.tool';
import { StalkerAnalyticsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.analytics.tool';

const run = async (
  tool: { run: () => any },
  input: unknown,
  org: Record<string, unknown> = { id: 'org-1' }
) => {
  const built = tool.run();
  const store = new Map<string, string>([['organization', JSON.stringify(org)]]);
  return built.execute(input, {
    requestContext: {
      get: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
    },
  });
};

const planMocks = () => ({
  assertCanUseStalker: jest.fn().mockResolvedValue(undefined),
  assertCanAddKeyword: jest.fn().mockResolvedValue(undefined),
  assertCanManualCheck: jest.fn().mockResolvedValue(undefined),
});

const refuse = (message: string, status = 402) =>
  new HttpException({ message, upgrade: true }, status);

const mention = (patch: Record<string, unknown> = {}) => ({
  id: 'm-1',
  createdAt: new Date('2026-11-12T00:00:00.000Z'),
  source: 'YOUTUBE',
  authorName: 'Ada',
  authorHandle: 'ada',
  text: 'seen this',
  url: 'https://example.com/m',
  sentiment: 'NEGATIVE',
  status: 'NEW',
  relevant: true,
  categoryDef: null as null,
  category: '',
  keyword: { phrase: 'crea8' },
  matchKind: 'KEYWORD',
  matchLabel: 'crea8',
  ...patch,
});

describe('stalker MCP tools', () => {
  const previousFlag = process.env.STALKER_ENABLED;

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.STALKER_ENABLED;
    } else {
      process.env.STALKER_ENABLED = previousFlag;
    }
  });

  it('registers the stalker tools by class with no name prefix', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    for (const name of [
      'StalkerProjectsTool',
      'StalkerMentionsTool',
      'StalkerKeywordsTool',
      'StalkerAlertsTool',
      'StalkerAnalyticsTool',
    ]) {
      expect(list).toContain(name);
    }
    expect(new StalkerProjectsTool({} as any, {} as any).name).toBe('stalkerProjectsTool');
    expect(new StalkerMentionsTool({} as any, {} as any).name).toBe('stalkerMentionsTool');
    expect(new StalkerKeywordsTool({} as any, {} as any).name).toBe('stalkerKeywordsTool');
    expect(new StalkerAlertsTool({} as any, {} as any).name).toBe('stalkerAlertsTool');
    expect(new StalkerAnalyticsTool({} as any, {} as any).name).toBe('stalkerAnalyticsTool');
    expect(new StalkerAnalyticsTool({} as any, {} as any).name.startsWith('mcp')).toBe(false);
  });

  it('stays hidden unless Stalker is enabled', () => {
    delete process.env.STALKER_ENABLED;
    const tools = [
      new StalkerProjectsTool({} as any, {} as any),
      new StalkerMentionsTool({} as any, {} as any),
      new StalkerKeywordsTool({} as any, {} as any),
      new StalkerAlertsTool({} as any, {} as any),
      new StalkerAnalyticsTool({} as any, {} as any),
    ];
    for (const tool of tools) {
      expect(tool.available()).toBe(false);
    }
    process.env.STALKER_ENABLED = 'true';
    for (const tool of tools) {
      expect(tool.available()).toBe(true);
    }
  });

  describe('project settings', () => {
    const stalker = {
      projects: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      saveCategories: jest.fn(),
      deleteProject: jest.fn(),
      requestScan: jest.fn(),
      latestScan: jest.fn(),
    };
    const entitlements = planMocks();
    const tool = new StalkerProjectsTool(stalker as any, entitlements as any);
    const stored = {
      id: 'proj-1',
      name: 'Old',
      description: 'Old description',
      color: '#71717a',
      publicDashboard: false,
      publicToken: 'share-token',
      webhookUrl: 'https://hooks.example/secret',
      alertsEnabled: true,
      alertEmail: 'owner@example.com',
      _count: { keywords: 2, mentions: 4 },
      categories: [{ id: 'cat-old', name: 'Praise', description: 'Kind words' }],
    };

    beforeEach(() => {
      Object.values(stalker).forEach((fn) => fn.mockReset());
      Object.values(entitlements).forEach((fn) => {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      });
      stored.name = 'Old';
      stored.description = 'Old description';
      stored.color = '#71717a';
      stored.publicDashboard = false;
      stored.categories = [{ id: 'cat-old', name: 'Praise', description: 'Kind words' }];
    });

    it('matches the settings screen for name, colour, categories, and public dashboard', async () => {
      stalker.updateProject.mockImplementation(async (_org: string, id: string, body: any) => ({
        ...stored,
        id,
        name: body.name,
        description: body.description,
        color: body.color,
        publicDashboard: body.publicDashboard,
      }));
      stalker.saveCategories.mockImplementation(async (_org: string, _id: string, categories: any[]) =>
        categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description || '',
        }))
      );

      const result = await run(tool, {
        action: 'update',
        projectId: 'proj-1',
        name: 'Crea8',
        description: 'Brand mentions',
        color: '#7e47eb',
        publicDashboard: true,
        categories: [
          { id: 'cat-old', name: 'Praise', description: 'Kind words' },
          { name: 'Complaint', description: 'Problems' },
        ],
      });

      expect(stalker.updateProject).toHaveBeenCalledWith('org-1', 'proj-1', {
        name: 'Crea8',
        description: 'Brand mentions',
        color: '#7e47eb',
        publicDashboard: true,
      });
      expect(stalker.saveCategories).toHaveBeenCalledWith('org-1', 'proj-1', [
        { id: 'cat-old', name: 'Praise', description: 'Kind words' },
        { name: 'Complaint', description: 'Problems' },
      ]);
      expect(result.output).toMatchObject({
        id: 'proj-1',
        name: 'Crea8',
        description: 'Brand mentions',
        color: '#7e47eb',
        publicDashboard: true,
        categories: [
          { id: 'cat-old', name: 'Praise', description: 'Kind words' },
          { name: 'Complaint', description: 'Problems' },
        ],
      });
      expect(result.output.webhookUrl).toBeUndefined();
      expect(result.output.publicToken).toBeUndefined();
    });

    it('scopes the update to the organization on the credential', async () => {
      stalker.updateProject.mockResolvedValue({ ...stored, name: 'Crea8' });

      await run(tool, { action: 'update', projectId: 'proj-1', name: 'Crea8' }, { id: 'org-2' });

      expect(stalker.updateProject).toHaveBeenCalledWith(
        'org-2',
        'proj-1',
        expect.objectContaining({ name: 'Crea8' })
      );
      expect(stalker.saveCategories).not.toHaveBeenCalled();
    });

    it('returns the Check button status for scan now', async () => {
      const latest = {
        runId: 'run-1',
        status: 'queued',
        trigger: 'manual',
        startedAt: '2026-11-12T05:00:00.000Z',
        finishedAt: null as null,
        error: '',
        sources: [{ id: 'youtube', ok: true, found: 0, stored: 0 }],
        totals: { found: 0, stored: 0, duplicates: 0, offTopic: 0 },
      };
      stalker.requestScan.mockResolvedValue({
        runId: 'run-1',
        status: 'queued',
        projectId: 'proj-1',
      });
      stalker.latestScan.mockResolvedValue(latest);

      const result = await run(tool, { action: 'scan', projectId: 'proj-1' });

      expect(stalker.requestScan).toHaveBeenCalledWith('org-1', 'proj-1', 'manual');
      expect(stalker.latestScan).toHaveBeenCalledWith('org-1', 'proj-1');
      expect(result.output.status).toBe(latest.status);
      expect(result.output.runId).toBe(latest.runId);
      expect(result.output.sources).toEqual(latest.sources);
      expect(result.output.totals).toEqual(latest.totals);
    });

    it('returns the latest check status when a scan was just rate limited', async () => {
      const latest = {
        runId: 'run-old',
        status: 'succeeded',
        finishedAt: '2026-11-12T04:50:00.000Z',
        sources: [{ id: 'youtube', ok: true, found: 2, stored: 1 }],
        totals: { found: 2, stored: 1, duplicates: 1, offTopic: 0 },
      };
      stalker.requestScan.mockRejectedValue(
        new HttpException(
          {
            statusCode: 429,
            message: 'A check just ran. Try again in 4 min',
            retryAt: '2026-11-12T05:30:00.000Z',
          },
          429
        )
      );
      stalker.latestScan.mockResolvedValue(latest);

      const result = await run(tool, { action: 'scan', projectId: 'proj-1' });

      expect(result.output.status).toBe('succeeded');
      expect(result.output.sources).toEqual(latest.sources);
      expect(result.output.notice).toBe('A check just ran. Try again in 4 min');
      expect(result.output.retryAt).toBe('2026-11-12T05:30:00.000Z');
    });

    it('blocks a lower plan and allows a higher plan to create and scan', async () => {
      entitlements.assertCanUseStalker.mockRejectedValueOnce(refuse(keywordUpgradeMessage('FREE')));

      const locked = await run(tool, { action: 'list' });

      expect(locked.output.error).toBe(keywordUpgradeMessage('FREE'));
      expect(stalker.projects).not.toHaveBeenCalled();

      entitlements.assertCanAddKeyword.mockRejectedValueOnce(refuse(keywordUpgradeMessage('STANDARD')));
      const overKeywords = await run(tool, {
        action: 'create',
        name: 'Crea8',
        color: '#7e47eb',
        categories: [{ name: 'Praise' }],
        keywords: [{ phrase: 'crea8' }],
      });
      expect(overKeywords.output.error).toBe(
        'Creator includes 3 Stalker keywords. Upgrade to track more.'
      );
      expect(stalker.createProject).not.toHaveBeenCalled();

      stalker.createProject.mockResolvedValue({
        id: 'proj-2',
        name: 'Crea8',
        description: '',
        color: '#7e47eb',
        categories: [{ id: 'cat-1', name: 'Praise', description: '' }],
      });
      const created = await run(tool, {
        action: 'create',
        name: 'Crea8',
        color: '#7e47eb',
        categories: [{ name: 'Praise' }],
        keywords: [{ phrase: 'crea8' }],
      });
      expect(entitlements.assertCanAddKeyword).toHaveBeenCalledWith('org-1');
      expect(stalker.createProject).toHaveBeenCalled();
      expect(created.output.id).toBe('proj-2');

      entitlements.assertCanManualCheck.mockRejectedValueOnce(refuse(manualCheckMessage(3), 429));
      const overChecks = await run(tool, { action: 'scan', projectId: 'proj-1' });
      expect(overChecks.output.error).toBe("You have used today's 3 checks. Upgrade for more.");
      expect(stalker.requestScan).not.toHaveBeenCalled();

      stalker.requestScan.mockResolvedValue({
        runId: 'run-2',
        status: 'queued',
        projectId: 'proj-1',
      });
      stalker.latestScan.mockResolvedValue({
        runId: 'run-2',
        status: 'queued',
        sources: [],
        totals: { found: 0, stored: 0, duplicates: 0, offTopic: 0 },
      });
      const scanned = await run(tool, { action: 'scan', projectId: 'proj-1' });
      expect(stalker.requestScan).toHaveBeenCalledWith('org-1', 'proj-1', 'manual');
      expect(scanned.output.status).toBe('queued');
    });
  });

  describe('mention actions', () => {
    const mentions = [mention()];
    const views: { id: string; name: string; filters: Record<string, unknown> }[] = [];
    const stalker = {
      mentions: jest.fn(),
      setMentionStatus: jest.fn(),
      setMentionRelevant: jest.fn(),
      deleteMention: jest.fn(),
      views: jest.fn(),
      createView: jest.fn(),
      deleteView: jest.fn(),
      reply: jest.fn(),
      assertMentionHistory: jest.fn(),
    };
    const entitlements = planMocks();
    const tool = new StalkerMentionsTool(stalker as any, entitlements as any);

    beforeEach(() => {
      Object.values(stalker).forEach((fn) => fn.mockReset());
      Object.values(entitlements).forEach((fn) => {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      });
      stalker.assertMentionHistory.mockResolvedValue(undefined);
      mentions.splice(0, mentions.length, mention());
      views.splice(0, views.length);
      stalker.mentions.mockImplementation(async (_org: string, query: any) => {
        const showHidden = query.offTopic === 'include' || query.status === 'IGNORED';
        const rows = mentions.filter((row) => showHidden || row.relevant);
        return {
          mentions: rows,
          nextCursor: null,
          hiddenOffTopic: showHidden ? 0 : mentions.filter((row) => !row.relevant).length,
        };
      });
      stalker.setMentionStatus.mockImplementation(async (_org: string, id: string, status: string) => {
        const row = mentions.find((item) => item.id === id);
        if (!row) {
          throw new HttpException('Mention not found', 404);
        }
        row.status = status;
        row.relevant = status !== 'IGNORED';
        return { updated: true };
      });
      stalker.setMentionRelevant.mockImplementation(
        async (_org: string, id: string, relevant: boolean) => {
          const row = mentions.find((item) => item.id === id);
          if (!row) {
            throw new HttpException('Mention not found', 404);
          }
          row.relevant = relevant;
          if (!relevant) row.status = 'IGNORED';
          if (relevant && row.status === 'IGNORED') row.status = 'NEW';
          return { updated: true, relevant };
        }
      );
      stalker.views.mockImplementation(async () => views.map((row) => ({ ...row })));
      stalker.createView.mockImplementation(async (_org: string, body: any) => {
        const saved = { id: 'view-1', name: body.name, filters: body.filters };
        views.push(saved);
        return saved;
      });
      stalker.deleteView.mockImplementation(async (_org: string, id: string) => {
        const index = views.findIndex((row) => row.id === id);
        if (index >= 0) views.splice(index, 1);
        return { deleted: true };
      });
    });

    it('hides a mention marked ignored from the default list', async () => {
      const marked = await run(tool, { action: 'status', id: 'm-1', status: 'IGNORED' });
      const listed = await run(tool, { action: 'list', projectId: 'proj-1' });

      expect(stalker.setMentionStatus).toHaveBeenCalledWith('org-1', 'm-1', 'IGNORED');
      expect(stalker.mentions).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ projectId: 'proj-1', offTopic: undefined, status: undefined })
      );
      expect(stalker.reply).not.toHaveBeenCalled();
      expect(marked.output).toEqual({ updated: true });
      expect(listed.output.mentions.map((row: { id: string }) => row.id)).not.toContain('m-1');
      expect(listed.output.hiddenOffTopic).toBe(1);
    });

    it('hides a mention marked off-topic the same way and still does not reply', async () => {
      await run(tool, { action: 'relevant', id: 'm-1', relevant: false });
      const listed = await run(tool, { projectId: 'proj-1' });

      expect(stalker.setMentionRelevant).toHaveBeenCalledWith('org-1', 'm-1', false);
      expect(stalker.reply).not.toHaveBeenCalled();
      expect(listed.output.mentions).toEqual([]);
    });

    it('saves a view and deletes it without deleting the mention', async () => {
      const saved = await run(tool, {
        action: 'saveView',
        projectId: 'proj-1',
        name: 'Negatives',
        filters: { sentiment: 'NEGATIVE', status: 'NEW' },
      });
      const listed = await run(tool, { action: 'views', projectId: 'proj-1' });
      const removed = await run(tool, { action: 'deleteView', id: 'view-1' });
      const after = await run(tool, { action: 'views', projectId: 'proj-1' });

      expect(stalker.createView).toHaveBeenCalledWith('org-1', {
        projectId: 'proj-1',
        name: 'Negatives',
        filters: { sentiment: 'NEGATIVE', status: 'NEW' },
      });
      expect(saved.output.name).toBe('Negatives');
      expect(listed.output.views).toEqual([
        { id: 'view-1', name: 'Negatives', filters: { sentiment: 'NEGATIVE', status: 'NEW' } },
      ]);
      expect(removed.output).toEqual({ deleted: true });
      expect(after.output.views).toEqual([]);
      expect(stalker.deleteMention).not.toHaveBeenCalled();
      expect(stalker.reply).not.toHaveBeenCalled();
    });

    it('blocks history past a lower plan and allows a 30-day window on a higher plan', async () => {
      entitlements.assertCanUseStalker.mockRejectedValueOnce(refuse(keywordUpgradeMessage('FREE')));
      const locked = await run(tool, { projectId: 'proj-1' });
      expect(locked.output.error).toBe(keywordUpgradeMessage('FREE'));
      expect(stalker.mentions).not.toHaveBeenCalled();

      stalker.assertMentionHistory.mockRejectedValueOnce(refuse(mentionHistoryMessage('STANDARD')));
      const tooOld = await run(tool, { projectId: 'proj-1', start: '2020-01-01' });
      expect(tooOld.output.error).toBe('Creator includes 30 days of mentions. Upgrade to see more.');
      expect(stalker.mentions).not.toHaveBeenCalled();

      const listed = await run(tool, { projectId: 'proj-1', date: '30d' });
      expect(stalker.assertMentionHistory).toHaveBeenCalledWith('org-1', {
        date: '30d',
        start: undefined,
        surface: 'mentions',
      });
      expect(listed.output.mentions.map((row: { id: string }) => row.id)).toContain('m-1');
    });
  });

  describe('keyword groups', () => {
    const groups = [
      { id: 'g-brand', name: 'My brand', position: 0, _count: { keywords: 1 } },
    ];
    const stalker = {
      groups: jest.fn(),
      createGroup: jest.fn(),
      deleteGroup: jest.fn(),
      createKeyword: jest.fn(),
      keywords: jest.fn(),
    };
    const entitlements = planMocks();
    const tool = new StalkerKeywordsTool(stalker as any, entitlements as any);

    beforeEach(() => {
      Object.values(stalker).forEach((fn) => fn.mockReset());
      Object.values(entitlements).forEach((fn) => {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      });
      groups.splice(0, groups.length, {
        id: 'g-brand',
        name: 'My brand',
        position: 0,
        _count: { keywords: 1 },
      });
      stalker.groups.mockImplementation(async () => groups.map((row) => ({ ...row })));
      stalker.createGroup.mockImplementation(async (_org: string, _projectId: string, name: string) => {
        const created = {
          id: 'g-new',
          name,
          position: groups.length,
          _count: { keywords: 0 },
        };
        groups.push(created);
        return created;
      });
      stalker.deleteGroup.mockImplementation(async (_org: string, _projectId: string, id: string) => {
        const index = groups.findIndex((row) => row.id === id);
        if (index < 0) {
          throw new HttpException('Group not found', 404);
        }
        groups.splice(index, 1);
        return { deleted: true };
      });
      stalker.createKeyword.mockImplementation(async (_org: string, body: any) => ({
        id: 'k-1',
        phrase: body.phrase,
        groupId: body.groupId,
      }));
    });

    it('passes a created group as groupId and delete removes it from the keywords screen', async () => {
      const created = await run(tool, {
        action: 'createGroup',
        projectId: 'proj-1',
        name: 'Campaigns',
      });
      const keyword = await run(tool, {
        action: 'create',
        projectId: 'proj-1',
        phrase: 'crea8',
        groupId: created.output.id,
      });
      const removed = await run(tool, {
        action: 'deleteGroup',
        projectId: 'proj-1',
        id: created.output.id,
      });
      const listed = await run(tool, { action: 'groups', projectId: 'proj-1' });

      expect(stalker.createGroup).toHaveBeenCalledWith('org-1', 'proj-1', 'Campaigns');
      expect(stalker.createKeyword).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ projectId: 'proj-1', phrase: 'crea8', groupId: 'g-new' })
      );
      expect(keyword.output).toEqual({ id: 'k-1', phrase: 'crea8' });
      expect(stalker.deleteGroup).toHaveBeenCalledWith('org-1', 'proj-1', 'g-new');
      expect(removed.output).toEqual({ deleted: true });
      expect(listed.output.groups.map((row: { id: string }) => row.id)).toEqual(['g-brand']);
    });

    it('returns the keywords-screen refusal when a group still has keywords', async () => {
      stalker.deleteGroup.mockRejectedValue(
        new BadRequestException('Move the keywords out of this group first')
      );

      const result = await run(tool, {
        action: 'deleteGroup',
        projectId: 'proj-1',
        id: 'g-brand',
      });

      expect(result.output.error).toBe('Move the keywords out of this group first');
    });

    it('blocks a lower plan and allows a higher plan to add a group and a keyword', async () => {
      entitlements.assertCanUseStalker.mockRejectedValueOnce(refuse(keywordUpgradeMessage('FREE')));
      const locked = await run(tool, {
        action: 'createGroup',
        projectId: 'proj-1',
        name: 'Campaigns',
      });
      expect(locked.output.error).toBe(keywordUpgradeMessage('FREE'));
      expect(stalker.createGroup).not.toHaveBeenCalled();

      entitlements.assertCanAddKeyword.mockRejectedValueOnce(refuse(keywordUpgradeMessage('STANDARD')));
      const overKeywords = await run(tool, {
        action: 'create',
        projectId: 'proj-1',
        phrase: 'crea8',
        groupId: 'g-brand',
      });
      expect(overKeywords.output.error).toBe(keywordUpgradeMessage('STANDARD'));
      expect(stalker.createKeyword).not.toHaveBeenCalled();

      const created = await run(tool, {
        action: 'createGroup',
        projectId: 'proj-1',
        name: 'Campaigns',
      });
      const keyword = await run(tool, {
        action: 'create',
        projectId: 'proj-1',
        phrase: 'crea8',
        groupId: created.output.id,
      });
      expect(stalker.createGroup).toHaveBeenCalledWith('org-1', 'proj-1', 'Campaigns');
      expect(stalker.createKeyword).toHaveBeenCalled();
      expect(keyword.output.phrase).toBe('crea8');
    });
  });

  describe('alert rule edit', () => {
    const rules = [
      {
        id: 'rule-1',
        name: 'Negatives',
        enabled: true,
        filters: { sentiment: 'NEGATIVE', status: 'NEW', source: 'youtube' },
      },
    ];
    const stalker = {
      alertRules: jest.fn(),
      updateAlertRule: jest.fn(),
      createAlertRule: jest.fn(),
      deleteAlertRule: jest.fn(),
    };
    const entitlements = planMocks();
    const tool = new StalkerAlertsTool(stalker as any, entitlements as any);

    beforeEach(() => {
      Object.values(stalker).forEach((fn) => fn.mockReset());
      Object.values(entitlements).forEach((fn) => {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      });
      rules.splice(0, rules.length, {
        id: 'rule-1',
        name: 'Negatives',
        enabled: true,
        filters: { sentiment: 'NEGATIVE', status: 'NEW', source: 'youtube' },
      });
      stalker.alertRules.mockImplementation(async () =>
        rules.map((rule) => ({ ...rule, filters: { ...rule.filters } }))
      );
      stalker.updateAlertRule.mockImplementation(async (_org: string, id: string, body: any) => {
        const rule = rules.find((item) => item.id === id);
        if (!rule) {
          throw new HttpException('Alert not found', 404);
        }
        if (typeof body.name === 'string') rule.name = body.name.trim();
        if (typeof body.enabled === 'boolean') rule.enabled = body.enabled;
        if (body.filters) rule.filters = body.filters;
        return { updated: true };
      });
    });

    it('renames a rule and keeps the old filters unless they were passed', async () => {
      const renamed = await run(tool, {
        action: 'update',
        id: 'rule-1',
        name: 'Urgent negatives',
      });
      const listed = await run(tool, { action: 'rules', projectId: 'proj-1' });

      expect(stalker.updateAlertRule).toHaveBeenCalledWith('org-1', 'rule-1', {
        name: 'Urgent negatives',
      });
      expect(renamed.output).toEqual({ updated: true });
      expect(listed.output.rules[0].name).toBe('Urgent negatives');
      expect(listed.output.rules[0].filters).toEqual({
        sentiment: 'NEGATIVE',
        status: 'NEW',
        source: 'youtube',
      });

      await run(tool, {
        action: 'update',
        id: 'rule-1',
        filters: { sentiment: 'POSITIVE' },
      });
      const changed = await run(tool, { action: 'rules', projectId: 'proj-1' });

      expect(stalker.updateAlertRule).toHaveBeenLastCalledWith('org-1', 'rule-1', {
        filters: { sentiment: 'POSITIVE' },
      });
      expect(changed.output.rules[0].name).toBe('Urgent negatives');
      expect(changed.output.rules[0].filters).toEqual({ sentiment: 'POSITIVE' });
    });

    it('blocks a lower plan and allows a higher plan to edit a rule', async () => {
      entitlements.assertCanUseStalker.mockRejectedValueOnce(refuse(keywordUpgradeMessage('FREE')));
      const locked = await run(tool, { action: 'update', id: 'rule-1', name: 'Urgent negatives' });
      expect(locked.output.error).toBe(keywordUpgradeMessage('FREE'));
      expect(stalker.updateAlertRule).not.toHaveBeenCalled();

      const renamed = await run(tool, { action: 'update', id: 'rule-1', name: 'Urgent negatives' });
      expect(stalker.updateAlertRule).toHaveBeenCalledWith('org-1', 'rule-1', {
        name: 'Urgent negatives',
      });
      expect(renamed.output).toEqual({ updated: true });
    });
  });

  describe('analytics', () => {
    const stalker = { analytics: jest.fn(), assertMentionHistory: jest.fn() };
    const entitlements = planMocks();
    const tool = new StalkerAnalyticsTool(stalker as any, entitlements as any);
    const screen = {
      totals: { mentions: 11, positive: 6, negative: 2, neutral: 3 },
      series: [{ date: '2026-11-12', positive: 6, negative: 2, neutral: 3 }],
      accounts: [{ authorName: 'Ada', count: 4 }],
    };

    beforeEach(() => {
      stalker.analytics.mockReset();
      stalker.analytics.mockResolvedValue(screen);
      stalker.assertMentionHistory.mockReset();
      stalker.assertMentionHistory.mockResolvedValue(undefined);
      Object.values(entitlements).forEach((fn) => {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      });
    });

    it('returns the analytics-screen totals for a project and a 30-day window', async () => {
      const result = await run(tool, { projectId: 'proj-1', date: '30d' });

      expect(stalker.analytics).toHaveBeenCalledWith(
        'org-1',
        'proj-1',
        '30d',
        expect.objectContaining({ projectId: 'proj-1', date: '30d' })
      );
      expect(result.output.totals).toEqual(screen.totals);
      expect(result.output.series).toEqual(screen.series);
      expect(result.output.accounts).toEqual(screen.accounts);
    });

    it('blocks history past a lower plan and allows the same window on a higher plan', async () => {
      entitlements.assertCanUseStalker.mockRejectedValueOnce(refuse(keywordUpgradeMessage('FREE')));
      const locked = await run(tool, { projectId: 'proj-1', date: '30d' });
      expect(locked.output.error).toBe(keywordUpgradeMessage('FREE'));
      expect(stalker.analytics).not.toHaveBeenCalled();

      stalker.assertMentionHistory.mockRejectedValueOnce(refuse(mentionHistoryMessage('STANDARD')));
      const tooOld = await run(tool, { projectId: 'proj-1', start: '2020-01-01' });
      expect(tooOld.output.error).toBe(mentionHistoryMessage('STANDARD'));
      expect(stalker.analytics).not.toHaveBeenCalled();

      const allowed = await run(tool, {
        projectId: 'proj-1',
        start: '2026-10-14',
        end: '2026-11-12',
      });
      expect(stalker.assertMentionHistory).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ date: '30d', start: '2026-10-14', surface: 'analytics' })
      );
      expect(allowed.output.totals).toEqual(screen.totals);
    });

    it('uses a 30-day window when date is omitted, and forwards the screen calendar range', async () => {
      await run(tool, { projectId: 'proj-1' });
      expect(stalker.analytics).toHaveBeenCalledWith(
        'org-1',
        'proj-1',
        '30d',
        expect.objectContaining({ projectId: 'proj-1', date: '30d' })
      );

      await run(tool, {
        projectId: 'proj-1',
        start: '2026-10-14',
        end: '2026-11-12',
        tz: -330,
        group: 'brand',
      });
      expect(stalker.analytics).toHaveBeenLastCalledWith(
        'org-1',
        'proj-1',
        '30d',
        expect.objectContaining({
          projectId: 'proj-1',
          date: '30d',
          start: '2026-10-14',
          end: '2026-11-12',
          tz: -330,
          group: 'brand',
        })
      );
    });
  });
});
