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
});
