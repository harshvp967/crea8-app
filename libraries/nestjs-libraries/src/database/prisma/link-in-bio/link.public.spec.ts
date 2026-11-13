jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: class AuthService {
    static comparePassword() {
      return false;
    }
    static hashPassword() {
      return 'hash';
    }
  },
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import {
  loadPublicLink,
  presentPublicLink,
  publicIconSrc,
  publicLinkCacheSeconds,
  publicSocialIconSrc,
} from '@gitroom/frontend/components/link-in-bio/link.load';
import { linkStartupKeys } from '@gitroom/frontend/components/link-in-bio/link.startup.keys';

const page = {
  id: 'page-1',
  organizationId: 'org-1',
  slug: 'ada',
  isPublic: true,
  name: 'Ada',
  bio: 'Hello',
  captureDoubleOptIn: false,
  captureAskName: true,
  captureNotify: false,
  mailchimpKey: '',
  mailchimpAudience: '',
  convertkitKey: '',
  convertkitForm: '',
  leadWebhookUrl: '',
  organization: { subscription: null as null },
  blocks: [
    {
      id: 'block-email',
      type: 'EMAIL_CAPTURE',
      title: 'Newsletter',
      enabled: true,
      sensitive: false,
    },
    {
      id: 'block-form',
      type: 'CONTACT_FORM',
      title: 'Contact',
      enabled: true,
      sensitive: false,
    },
  ],
};

describe('Link-in-Bio public page and lead capture', () => {
  const previous = process.env.PUBLIC_LINK_CACHE_SECONDS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.PUBLIC_LINK_CACHE_SECONDS;
    } else {
      process.env.PUBLIC_LINK_CACHE_SECONDS = previous;
    }
    delete process.env.BACKEND_INTERNAL_URL;
  });

  it('hides blocks on a sensitive public page until the visitor confirms', () => {
    const open = presentPublicLink({
      slug: 'ada',
      sensitive: false,
      isPublic: true,
      blocks: [{ id: '1' }],
      capture: { askName: true },
      redirectUrl: 'https://example.com',
    } as never);
    expect(open.gated).toBe(false);
    expect(open.initial.blocks).toHaveLength(1);
    const gated = presentPublicLink({
      slug: 'ada',
      sensitive: true,
      isPublic: true,
      blocks: [{ id: '1' }],
      capture: { askName: true },
      redirectUrl: 'https://example.com',
    } as never);
    expect(gated.gated).toBe(true);
    expect(gated.initial.blocks).toEqual([]);
    expect(gated.initial.capture).toBeNull();
    expect(gated.initial.redirectUrl).toBe('');
  });

  it('resolves public social icons from the app origin in production', () => {
    expect(publicSocialIconSrc('instagram', { nodeEnv: 'development' })).toBe('/icons/platforms/instagram.png');
    expect(publicSocialIconSrc('instagram', { nodeEnv: 'production' })).toBe(
      'https://app.crea8.one/icons/platforms/instagram.png'
    );
    expect(publicSocialIconSrc('x', { nodeEnv: 'production', assetPrefix: 'https://cdn.example' })).toBe(
      'https://cdn.example/icons/platforms/x.png'
    );
    expect(publicSocialIconSrc('website', { nodeEnv: 'production' })).toBe('');
    expect(publicIconSrc('https://cdn.example/icon.png', { nodeEnv: 'production' })).toBe('https://cdn.example/icon.png');
  });

  it('caches the public page fetch and returns null without a backend', async () => {
    delete process.env.PUBLIC_LINK_CACHE_SECONDS;
    expect(publicLinkCacheSeconds()).toBe(60);
    expect(await loadPublicLink('/public/link/ada')).toBeNull();
    process.env.BACKEND_INTERNAL_URL = 'http://backend:3000';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ slug: 'ada', name: 'Ada' }),
    });
    const original = global.fetch;
    global.fetch = fetchMock as never;
    try {
      const loaded = await loadPublicLink('/public/link/ada');
      expect(loaded).toEqual({ slug: 'ada', name: 'Ada' });
      expect(fetchMock).toHaveBeenCalledWith('http://backend:3000/public/link/ada', {
        next: { revalidate: 60, tags: ['public-link'] },
      });
    } finally {
      global.fetch = original;
    }
  });

  const leadService = () => {
    const repository = {
      findBySlug: jest.fn().mockResolvedValue(page),
      findLead: jest.fn().mockResolvedValue(null),
      createLead: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      updateLead: jest.fn(),
    };
    const email = { sendEmailSync: jest.fn().mockResolvedValue(true) };
    const service = new LinkService(repository as never, {} as never, email as never, {} as never);
    return { service, repository, email };
  };

  it('stores a new subscriber and ignores a second pending one', async () => {
    const { service, repository } = leadService();
    await expect(service.subscribe({ slug: 'Ada', email: 'Ada@Example.com', name: 'Ada' } as never, 'IN')).resolves.toEqual({
      status: 'confirmed',
      emailed: false,
    });
    expect(repository.createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'page-1',
        email: 'ada@example.com',
        name: 'Ada',
        status: 'CONFIRMED',
      })
    );
    repository.findLead.mockResolvedValue({ status: 'CONFIRMED' });
    await expect(service.subscribe({ slug: 'ada', email: 'ada@example.com' } as never, '')).resolves.toEqual({
      status: 'confirmed',
      already: true,
    });
    expect(repository.createLead).toHaveBeenCalledTimes(1);
  });

  it('rejects a bad email and a missing capture block', async () => {
    const { service, repository } = leadService();
    await expect(service.subscribe({ slug: 'ada', email: 'nope' } as never, '')).rejects.toBeInstanceOf(
      BadRequestException
    );
    repository.findBySlug.mockResolvedValue({ ...page, blocks: [] });
    await expect(service.subscribe({ slug: 'ada', email: 'ada@example.com' } as never, '')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('returns only public slugs that can be a page address', async () => {
    const repository = {
      publicSlugs: jest.fn().mockResolvedValue([
        { slug: 'ada' },
        { slug: 'privacy' },
        { slug: 'crea8.one' },
        { slug: '' },
      ]),
    };
    const service = new LinkService(repository as never, {} as never, {} as never, {} as never);
    await expect(service.publicSlugs()).resolves.toEqual({ slugs: ['ada', 'crea8.one'] });
    expect(repository.publicSlugs).toHaveBeenCalledTimes(1);
  });

  it('drops a honeypot contact and stores a real message once', async () => {
    const { service, repository } = leadService();
    await expect(
      service.contact(
        { slug: 'ada', blockId: 'block-form', email: 'ada@example.com', message: 'hi', website: 'https://spam.test' } as never,
        ''
      )
    ).resolves.toEqual({ ok: true });
    expect(repository.createLead).not.toHaveBeenCalled();
    await expect(
      service.contact(
        { slug: 'ada', blockId: 'block-form', email: 'Ada@Example.com', message: 'Hello there', name: 'Ada' } as never,
        'US'
      )
    ).resolves.toEqual({ ok: true });
    expect(repository.createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        message: 'Hello there',
        kind: 'contact',
        status: 'CONFIRMED',
      })
    );
  });

  it('emits a link click for a live link and a form submission for a new contact', async () => {
    const webhooks = { emit: jest.fn().mockResolvedValue(undefined) };
    const repository = {
      findBySlug: jest.fn().mockResolvedValue({
        ...page,
        blocks: [
          ...page.blocks,
          {
            id: 'block-link',
            type: 'LINK',
            title: 'Site',
            url: 'https://crea8.one',
            enabled: true,
          },
        ],
      }),
      findLead: jest.fn().mockResolvedValue(null),
      createLead: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      updateLead: jest.fn(),
      insertEvent: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LinkService(
      repository as never,
      {} as never,
      { sendEmailSync: jest.fn() } as never,
      {} as never,
      undefined,
      webhooks as never
    );

    await service.track('VIEW', { slug: 'ada' } as never, '', '');
    expect(webhooks.emit).not.toHaveBeenCalled();
    expect(repository.insertEvent).toHaveBeenCalledTimes(1);

    repository.insertEvent.mockClear();
    await service.track('CLICK', { slug: 'ada', blockId: 'missing' } as never, '', '');
    expect(webhooks.emit).not.toHaveBeenCalled();
    expect(repository.insertEvent).not.toHaveBeenCalled();

    await service.track('CLICK', { slug: 'ada', blockId: 'block-link' } as never, '', '');
    expect(webhooks.emit).toHaveBeenCalledWith(
      'org-1',
      'link.click',
      expect.objectContaining({
        event: 'link.click',
        slug: 'ada',
        pageId: 'page-1',
        blockId: 'block-link',
        title: 'Site',
        url: 'https://crea8.one',
      })
    );

    webhooks.emit.mockClear();
    await service.contact(
      {
        slug: 'ada',
        blockId: 'block-form',
        email: 'ada@example.com',
        message: 'hi',
        website: 'https://spam.test',
      } as never,
      ''
    );
    expect(webhooks.emit).not.toHaveBeenCalled();

    await service.contact(
      { slug: 'ada', blockId: 'block-form', email: 'Ada@Example.com', message: 'Hello there', name: 'Ada' } as never,
      'US'
    );
    expect(webhooks.emit).toHaveBeenCalledWith(
      'org-1',
      'link.submission',
      expect.objectContaining({
        event: 'link.submission',
        kind: 'contact',
        email: 'ada@example.com',
        name: 'Ada',
        message: 'Hello there',
        status: 'CONFIRMED',
      })
    );
  });
});

const editorPage = {
  id: 'page-1',
  organizationId: 'org-1',
  slug: 'ada',
  name: 'Ada',
  bio: '',
  avatarPath: '',
  theme: 'midnight',
  buttonStyle: 'pill',
  font: 'Plus Jakarta Sans',
  backgroundMode: 'colour',
  backgroundColor: '',
  backgroundImage: '',
  seoTitle: '',
  seoDescription: '',
  isPublic: true,
  sensitive: false,
  hideBadge: false,
  timezone: 'UTC',
  customDomain: '',
  domainStatus: 'NONE',
  domainError: '',
  domainCheckedAt: null as null,
  domainTxtName: '',
  domainTxtValue: '',
  captureHeading: '',
  captureButton: 'Subscribe',
  captureConsent: '',
  captureAskName: false,
  captureDoubleOptIn: true,
  captureNotify: false,
  socials: [] as [],
  design: {},
  mailchimpKey: '',
  mailchimpAudience: '',
  convertkitKey: '',
  convertkitForm: '',
  leadWebhookUrl: '',
  leadWebhookSecret: '',
  organization: { name: 'Ada', deletedAt: null as null, customDomainAddon: false, subscription: null as null },
  blocks: [
    {
      id: 'block-1',
      type: 'LINK',
      position: 0,
      enabled: true,
      title: 'Site',
      url: 'https://crea8.one',
      priority: false,
      scheduleOn: false,
      startsAt: null as null,
      endsAt: null as null,
      postId: null as null,
      thumbnail: '',
      iconMode: '',
      spotlight: false,
      body: '',
      payload: {},
      lockType: 'NONE',
      lockHash: '',
      post: null as null,
    },
  ],
};

describe('Link-in-Bio page and leads load', () => {
  it('counts clicks for the blocks on the page instead of every event', async () => {
    const repository = {
      findByOrg: jest.fn().mockResolvedValue(editorPage),
      clickCounts: jest.fn().mockResolvedValue([{ blockId: 'block-1', _count: { _all: 3 } }]),
      connectedAccounts: jest.fn().mockResolvedValue([]),
    };
    const service = new LinkService(
      repository as never,
      { configured: () => false, cnameTarget: () => 'cname.crea8.one' } as never,
      {} as never,
      { getSocialIntegration: (): undefined => undefined } as never
    );
    const editor = await service.page({ id: 'org-1', name: 'Ada' });
    expect(repository.findByOrg).toHaveBeenCalledTimes(1);
    expect(repository.clickCounts).toHaveBeenCalledWith(['block-1']);
    expect(editor.blocks[0].clicks).toBe(3);
  });

  it('loads leads from the page id without the editor graph', async () => {
    const repository = {
      findPageMeta: jest.fn().mockResolvedValue({ id: 'page-1', slug: 'ada', timezone: 'UTC' }),
      findByOrg: jest.fn(),
      leadCounts: jest.fn().mockResolvedValue([
        { status: 'CONFIRMED', _count: { _all: 2 } },
        { status: 'PENDING', _count: { _all: 1 } },
      ]),
      leads: jest.fn().mockResolvedValue([
        {
          id: 'lead-1',
          name: 'Ada',
          email: 'ada@example.com',
          country: 'US',
          sourceBlock: 'Email capture',
          status: 'CONFIRMED',
          kind: 'subscribe',
          message: '',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
      publishedPosts: jest.fn().mockResolvedValue([]),
    };
    const service = new LinkService(repository as never, {} as never, {} as never, {} as never);
    const result = await service.leads({ id: 'org-1' } as never, '', '');
    expect(repository.findByOrg).not.toHaveBeenCalled();
    expect(repository.leads).toHaveBeenCalledWith('page-1', '', '', 500);
    expect(result.counts).toEqual({ all: 3, confirmed: 2, pending: 1 });
    expect(result.leads[0].email).toBe('ada@example.com');

    await service.posts({ id: 'org-1' } as never);
    expect(repository.findByOrg).not.toHaveBeenCalled();
    expect(repository.publishedPosts).toHaveBeenCalledWith('org-1');
  });

  it('starts the link and leads reads with the shell, and leaves the calendar alone', () => {
    expect(linkStartupKeys('/linkinbio')).toEqual({
      page: '/link-in-bio',
      posts: '/link-in-bio/posts',
      leads: null,
    });
    expect(linkStartupKeys('/linkinbio/leads')).toEqual({
      page: '/link-in-bio',
      posts: null,
      leads: '/link-in-bio/leads?status=&q=',
    });
    expect(linkStartupKeys('/schedule')).toEqual({ page: null, posts: null, leads: null });
    expect(linkStartupKeys('/linkinbio/analytics').posts).toBeNull();
    expect(linkStartupKeys('/linkinbio/analytics').leads).toBeNull();
  });
});
