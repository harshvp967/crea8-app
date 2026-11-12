import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service',
  () => ({
    LinkService: class LinkService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({
    OrganizationService: class OrganizationService {},
  })
);

import { LinkPageTool } from '@gitroom/nestjs-libraries/chat/tools/link.page.tool';
import { LinkDomainTool } from '@gitroom/nestjs-libraries/chat/tools/link.domain.tool';
import { LinkAnalyticsTool } from '@gitroom/nestjs-libraries/chat/tools/link.analytics.tool';
import { LinkLeadsTool } from '@gitroom/nestjs-libraries/chat/tools/link.leads.tool';
import { paidFeatureProblem } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

const themeRefused = paidFeatureProblem(false, 'theme');
const analyticsRefused = paidFeatureProblem(false, 'deepAnalytics');
const badgeRefused = 'Removing the badge is on a paid plan';
const domainRefused = 'Custom domains are a separate add-on';
const ownerRefused = 'Only the workspace owner can delete a lead';

const paymentRequired = (message: string) =>
  new HttpException({ message, upgrade: true }, 402);

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

describe('link MCP tools', () => {
  it('registers the link tools by class with no name prefix', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    for (const name of ['LinkPageTool', 'LinkDomainTool', 'LinkAnalyticsTool', 'LinkLeadsTool']) {
      expect(list).toContain(name);
    }
    expect(new LinkPageTool({} as any).name).toBe('linkPageTool');
    expect(new LinkDomainTool({} as any).name).toBe('linkDomainTool');
    expect(new LinkAnalyticsTool({} as any).name).toBe('linkAnalyticsTool');
    expect(new LinkLeadsTool({} as any, {} as any).name).toBe('linkLeadsTool');
    expect(new LinkPageTool({} as any).name.startsWith('mcp')).toBe(false);
  });

  describe('page appearance and SEO image', () => {
    const link = {
      page: jest.fn(),
      setSlug: jest.fn(),
      update: jest.fn(),
      deletePage: jest.fn(),
    };
    const tool = new LinkPageTool(link as any);

    beforeEach(() => {
      Object.values(link).forEach((fn) => fn.mockReset());
    });

    it('passes avatar, font, background, colours, Open Graph image, sensitive, and badge through update', async () => {
      link.update.mockImplementation(async (_org: unknown, body: Record<string, unknown>) => ({
        id: 'page-1',
        ...body,
      }));

      const result = await run(tool, {
        action: 'update',
        avatarPath: '/uploads/avatar.png',
        font: 'Georgia',
        backgroundMode: 'colour',
        backgroundColor: '#102117',
        backgroundImage: '/uploads/bg.png',
        colors: {
          background: '#102117',
          button: '#1d3b2c',
          buttonText: '#eef8f1',
          pageText: '#eef8f1',
          title: '#eef8f1',
        },
        ogImage: 'https://cdn.example.com/share.png',
        sensitive: true,
        hideBadge: false,
        seoTitle: 'Harsh',
        seoDescription: 'Links and posts',
      });

      expect(link.update).toHaveBeenCalledWith(
        { id: 'org-1' },
        {
          name: undefined,
          bio: undefined,
          avatarPath: '/uploads/avatar.png',
          isPublic: undefined,
          theme: undefined,
          buttonStyle: undefined,
          font: 'Georgia',
          backgroundMode: 'colour',
          backgroundColor: '#102117',
          backgroundImage: '/uploads/bg.png',
          seoTitle: 'Harsh',
          seoDescription: 'Links and posts',
          sensitive: true,
          hideBadge: false,
          design: {
            ogImage: 'https://cdn.example.com/share.png',
            colors: {
              background: '#102117',
              button: '#1d3b2c',
              buttonText: '#eef8f1',
              pageText: '#eef8f1',
              title: '#eef8f1',
            },
          },
        }
      );
      expect(result.output.seoTitle).toBe('Harsh');
      expect(result.output.seoDescription).toBe('Links and posts');
      expect(link.deletePage).not.toHaveBeenCalled();
    });

    it('still updates title and description when appearance fields are omitted', async () => {
      link.update.mockImplementation(async (_org: unknown, body: Record<string, unknown>) => body);

      const result = await run(tool, {
        action: 'update',
        seoTitle: 'New title',
        seoDescription: 'New description',
      });

      expect(link.update).toHaveBeenCalledWith(
        { id: 'org-1' },
        expect.objectContaining({
          seoTitle: 'New title',
          seoDescription: 'New description',
        })
      );
      const body = link.update.mock.calls[0][1];
      expect(body.design).toBeUndefined();
      expect(result.output.seoTitle).toBe('New title');
      expect(result.output.seoDescription).toBe('New description');
    });

    it('returns the screen payment-required error for a pro theme on a free page', async () => {
      link.update.mockImplementation(async (_org: unknown, body: { theme?: string }) => {
        if (body.theme) {
          throw paymentRequired(themeRefused!);
        }
        return body;
      });

      const result = await run(tool, { action: 'update', theme: 'aurora' });

      expect(link.update).toHaveBeenCalledWith(
        { id: 'org-1' },
        expect.objectContaining({ theme: 'aurora' })
      );
      expect(result.output.error).toBe('That theme is on a paid plan');
    });

    it('returns the screen payment-required error when a free page hides the badge', async () => {
      link.update.mockImplementation(async (_org: unknown, body: { hideBadge?: boolean }) => {
        if (body.hideBadge) {
          throw paymentRequired(badgeRefused);
        }
        return body;
      });

      const result = await run(tool, { action: 'update', hideBadge: true });

      expect(link.update).toHaveBeenCalledWith(
        { id: 'org-1' },
        expect.objectContaining({ hideBadge: true })
      );
      expect(result.output.error).toBe(badgeRefused);
    });

    it('blocks a pro theme on a free page and allows it on a paid page', async () => {
      link.update.mockRejectedValueOnce(paymentRequired(themeRefused!));

      const blocked = await run(tool, { action: 'update', theme: 'aurora' });

      expect(blocked.output.error).toBe('That theme is on a paid plan');
      expect(link.update).toHaveBeenCalledTimes(1);

      link.update.mockResolvedValueOnce({ id: 'page-1', theme: 'aurora' });
      const allowed = await run(tool, { action: 'update', theme: 'aurora' });

      expect(link.update).toHaveBeenCalledTimes(2);
      expect(allowed.output.theme).toBe('aurora');
    });
  });

  describe('custom domain', () => {
    const records = [
      { type: 'CNAME', name: 'links', value: 'customers.crea8.one', ttl: 'Auto' },
      { type: 'TXT', name: '_acme-challenge.links', value: 'token', ttl: 'Auto' },
    ];
    const link = {
      connectDomain: jest.fn(),
      checkDomain: jest.fn(),
      removeDomain: jest.fn(),
    };
    const tool = new LinkDomainTool(link as any);
    const connected = {
      available: true,
      page: {
        customDomain: 'links.example.com',
        domainStatus: 'WAITING',
        domainRecords: records,
        domainError: '',
      },
    };

    beforeEach(() => {
      Object.values(link).forEach((fn) => fn.mockReset());
    });

    it('returns the settings-screen status and DNS records on connect', async () => {
      link.connectDomain.mockResolvedValue(connected);

      const result = await run(tool, { action: 'connect', domain: 'links.example.com' });

      expect(link.connectDomain).toHaveBeenCalledWith({ id: 'org-1' }, 'links.example.com');
      expect(result.output.page.domainStatus).toBe('WAITING');
      expect(result.output.page.domainRecords).toEqual(records);
    });

    it('returns the same status and DNS records on check', async () => {
      link.checkDomain.mockResolvedValue({
        ...connected,
        page: { ...connected.page, domainStatus: 'LIVE' },
      });

      const result = await run(tool, { action: 'check' });

      expect(link.checkDomain).toHaveBeenCalledWith({ id: 'org-1' });
      expect(result.output.page.domainStatus).toBe('LIVE');
      expect(result.output.page.domainRecords).toEqual(records);
    });

    it('removes the domain and returns the cleared status', async () => {
      link.removeDomain.mockResolvedValue({
        available: true,
        page: { customDomain: '', domainStatus: 'NONE', domainRecords: [] },
      });

      const result = await run(tool, { action: 'remove' });

      expect(link.removeDomain).toHaveBeenCalledWith({ id: 'org-1' });
      expect(result.output.page.domainStatus).toBe('NONE');
      expect(result.output.page.domainRecords).toEqual([]);
    });

    it('refuses a page without the custom-domain add-on', async () => {
      link.connectDomain.mockRejectedValue(paymentRequired(domainRefused));

      const result = await run(tool, { action: 'connect', domain: 'links.example.com' });

      expect(link.connectDomain).toHaveBeenCalledWith({ id: 'org-1' }, 'links.example.com');
      expect(result.output.error).toBe(domainRefused);
      expect(result.output.page).toBeUndefined();
    });

    it('blocks a page without the add-on and allows a page that has it', async () => {
      link.connectDomain.mockRejectedValueOnce(paymentRequired(domainRefused));

      const blocked = await run(tool, { action: 'connect', domain: 'links.example.com' });

      expect(blocked.output.error).toBe(domainRefused);

      link.connectDomain.mockResolvedValueOnce(connected);
      const allowed = await run(tool, { action: 'connect', domain: 'links.example.com' });

      expect(allowed.output.page.domainStatus).toBe('WAITING');
      expect(allowed.output.page.domainRecords).toEqual(records);
    });
  });

  describe('analytics export', () => {
    const csv = 'kind,label,views\nlink,Site,4\n';
    const link = {
      analytics: jest.fn(),
      exportAnalytics: jest.fn(),
    };
    const tool = new LinkAnalyticsTool(link as any);

    beforeEach(() => {
      link.analytics.mockReset();
      link.exportAnalytics.mockReset();
    });

    it('returns the CSV for the same range as GET /link-in-bio/analytics.csv', async () => {
      link.exportAnalytics.mockResolvedValue(csv);

      const result = await run(tool, {
        format: 'csv',
        range: '28d',
        from: '2026-01-01',
        to: '2026-01-28',
      });

      expect(link.exportAnalytics).toHaveBeenCalledWith(
        { id: 'org-1' },
        '28d',
        '2026-01-01',
        '2026-01-28'
      );
      expect(link.analytics).not.toHaveBeenCalled();
      expect(result.output).toEqual({ csv, filename: 'crea8-analytics.csv' });
    });

    it('refuses the CSV on a free page', async () => {
      link.exportAnalytics.mockRejectedValue(paymentRequired(analyticsRefused!));

      const result = await run(tool, { format: 'csv', range: '30d' });

      expect(link.exportAnalytics).toHaveBeenCalledWith({ id: 'org-1' }, '30d', '', '');
      expect(result.output.error).toBe('Deeper analytics are on a paid plan');
      expect(result.output.csv).toBeUndefined();
    });

    it('blocks the CSV on a free page and allows it on a paid page', async () => {
      link.exportAnalytics.mockRejectedValueOnce(paymentRequired(analyticsRefused!));

      const blocked = await run(tool, { format: 'csv', range: '30d' });

      expect(blocked.output.error).toBe('Deeper analytics are on a paid plan');
      expect(blocked.output.csv).toBeUndefined();

      link.exportAnalytics.mockResolvedValueOnce(csv);
      const allowed = await run(tool, { format: 'csv', range: '30d' });

      expect(allowed.output).toEqual({ csv, filename: 'crea8-analytics.csv' });
    });

    it('still reads analytics when no CSV is requested', async () => {
      link.analytics.mockResolvedValue({ range: '30d', views: 3 });

      const result = await run(tool, { range: '7d' });

      expect(link.analytics).toHaveBeenCalledWith({ id: 'org-1' }, '7d', '', '');
      expect(link.exportAnalytics).not.toHaveBeenCalled();
      expect(result.output).toEqual({ range: '30d', views: 3 });
    });
  });

  describe('lead delete', () => {
    const leadId = '11111111-1111-4111-8111-111111111111';
    const link = {
      leads: jest.fn(),
      deleteLead: jest.fn(),
      deletePage: jest.fn(),
    };
    const organizations = { getTeam: jest.fn() };
    const tool = new LinkLeadsTool(link as any, organizations as any);

    beforeEach(() => {
      link.leads.mockReset();
      link.deleteLead.mockReset();
      link.deletePage.mockReset();
      organizations.getTeam.mockReset();
    });

    it('deletes one lead for the signed-in owner and does not delete the page', async () => {
      link.deleteLead.mockResolvedValue({ id: leadId });

      const result = await run(tool, { action: 'delete', id: leadId }, { id: 'org-1', userId: 'owner-1' });

      expect(link.deleteLead).toHaveBeenCalledWith('org-1', 'owner-1', leadId);
      expect(organizations.getTeam).not.toHaveBeenCalled();
      expect(link.deletePage).not.toHaveBeenCalled();
      expect(result.output).toEqual({ id: leadId });
    });

    it('uses the workspace owner when the credential is an API key', async () => {
      organizations.getTeam.mockResolvedValue({
        users: [
          { role: 'USER', user: { id: 'member-1', email: 'member@example.com' } },
          { role: 'SUPERADMIN', user: { id: 'owner-1', email: 'owner@example.com' } },
        ],
      });
      link.deleteLead.mockResolvedValue({ id: leadId });

      const result = await run(tool, { action: 'delete', id: leadId });

      expect(organizations.getTeam).toHaveBeenCalledWith('org-1');
      expect(link.deleteLead).toHaveBeenCalledWith('org-1', 'owner-1', leadId);
      expect(JSON.stringify(result)).not.toContain('owner@example.com');
      expect(result.output).toEqual({ id: leadId });
    });

    it('refuses a lead delete from someone who is not the workspace owner', async () => {
      link.deleteLead.mockRejectedValue(new HttpException(ownerRefused, 403));

      const result = await run(
        tool,
        { action: 'delete', id: leadId },
        { id: 'org-1', userId: 'member-1' }
      );

      expect(link.deleteLead).toHaveBeenCalledWith('org-1', 'member-1', leadId);
      expect(result.output.error).toBe(ownerRefused);
      expect(link.deletePage).not.toHaveBeenCalled();
    });

    it('still reads leads when no delete is requested', async () => {
      link.leads.mockResolvedValue({ counts: { all: 1 }, leads: [] });

      const result = await run(tool, { status: 'CONFIRMED', q: 'ada' });

      expect(link.leads).toHaveBeenCalledWith({ id: 'org-1' }, 'CONFIRMED', 'ada');
      expect(link.deleteLead).not.toHaveBeenCalled();
      expect(result.output.counts.all).toBe(1);
    });
  });
});
