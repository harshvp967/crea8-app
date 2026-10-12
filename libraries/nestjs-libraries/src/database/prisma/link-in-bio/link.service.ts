import { createHmac, randomBytes } from 'crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { CloudflareCustomHostnameService } from '@gitroom/nestjs-libraries/services/cloudflare.custom-hostname.service';
import {
  openIntegrationSecret,
  sealIntegrationSecret,
} from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.token.crypto';
import {
  LinkRepository,
  LinkPageRecord,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.repository';
import {
  LINK_BLOCK_CAP,
  analyticsToCsv,
  blockState,
  buildAnalytics,
  captureUtm,
  cleanCountry,
  clientLabel,
  contactDecision,
  countryName,
  customWindow,
  domainProblem,
  domainRecords,
  emailProblem,
  embedProblem,
  fillDays,
  firstImage,
  hasCustomDomainAddon,
  imagePathProblem,
  isPaidPlan,
  isValidTimeZone,
  leadsToCsv,
  lockProblem,
  normalizeFaq,
  normalizeForm,
  normalizeImages,
  pageUrl,
  paidFeatureProblem,
  plainText,
  platformLabel,
  presentPublicBlock,
  publicAsset,
  publicOrigin,
  rangeWindow,
  sanitizeReferrer,
  secretHint,
  shareRows,
  shortDate,
  showBadge,
  slugProblem,
  sourceLabel,
  suggestSlug,
  urlProblem,
  utcDay,
  webhookProblem,
  zonedLocalToUtc,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  PublicLinkContactDto,
  PublicLinkSubscribeDto,
  PublicLinkTrackDto,
  PublicLinkUnlockDto,
  SaveLinkBlockDto,
  UpdateLinkIntegrationsDto,
  UpdateLinkPageDto,
} from '@gitroom/nestjs-libraries/dtos/link-in-bio/link.dto';

type PlanOrg = {
  id: string;
  name?: string | null;
  subscription?: {
    subscriptionTier?: string | null;
    isLifetime?: boolean | null;
    deletedAt?: Date | null;
  } | null;
};

@Injectable()
export class LinkService {
  constructor(
    private _repository: LinkRepository,
    private _cloudflare: CloudflareCustomHostnameService,
    private _email: EmailService
  ) {}

  async page(org: PlanOrg, timezone?: string) {
    const record = await this.ensure(org, timezone);
    return this.toEditor(record);
  }

  async update(org: PlanOrg, body: UpdateLinkPageDto) {
    const record = await this.ensure(org);
    if (body.hideBadge && !isPaidPlan(record.organization.subscription)) {
      throw new HttpException(
        { message: 'Removing the badge is on a paid plan', upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (body.timezone && !isValidTimeZone(body.timezone)) {
      throw new BadRequestException('Choose a valid timezone');
    }
    const socials = body.socials
      ? body.socials
          .map((item) => ({ network: item.network, url: item.url.trim() }))
          .filter((item) => item.url && !urlProblem(item.url))
      : undefined;
    const next = await this._repository.update(record.id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.bio !== undefined ? { bio: body.bio.trim() } : {}),
      ...(body.avatarPath !== undefined ? { avatarPath: body.avatarPath.trim() } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.buttonStyle !== undefined ? { buttonStyle: body.buttonStyle } : {}),
      ...(body.font !== undefined ? { font: body.font } : {}),
      ...(body.backgroundMode !== undefined ? { backgroundMode: body.backgroundMode } : {}),
      ...(body.backgroundColor !== undefined ? { backgroundColor: body.backgroundColor.trim() } : {}),
      ...(body.backgroundImage !== undefined ? { backgroundImage: body.backgroundImage.trim() } : {}),
      ...(body.seoTitle !== undefined ? { seoTitle: body.seoTitle.trim() } : {}),
      ...(body.seoDescription !== undefined ? { seoDescription: body.seoDescription.trim() } : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      ...(body.sensitive !== undefined ? { sensitive: body.sensitive } : {}),
      ...(body.hideBadge !== undefined ? { hideBadge: body.hideBadge } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.captureHeading !== undefined ? { captureHeading: body.captureHeading.trim() } : {}),
      ...(body.captureButton !== undefined ? { captureButton: body.captureButton.trim() || 'Subscribe' } : {}),
      ...(body.captureConsent !== undefined ? { captureConsent: body.captureConsent.trim() } : {}),
      ...(body.captureAskName !== undefined ? { captureAskName: body.captureAskName } : {}),
      ...(body.captureDoubleOptIn !== undefined ? { captureDoubleOptIn: body.captureDoubleOptIn } : {}),
      ...(body.captureNotify !== undefined ? { captureNotify: body.captureNotify } : {}),
      ...(socials ? { socials } : {}),
    });
    return this.toEditor(next);
  }

  async checkSlug(org: PlanOrg, slug: string) {
    const record = await this.ensure(org);
    const problem = slugProblem(slug);
    if (problem) {
      return { ok: false, slug: slug.trim().toLowerCase(), message: problem };
    }
    const normalized = slug.trim().toLowerCase();
    const owner = await this._repository.slugOwner(normalized);
    if (owner && owner.id !== record.id) {
      return { ok: false, slug: normalized, message: 'That username is taken' };
    }
    return { ok: true, slug: normalized, message: 'Available' };
  }

  async setSlug(org: PlanOrg, slug: string) {
    const checked = await this.checkSlug(org, slug);
    if (!checked.ok) {
      throw new BadRequestException(checked.message);
    }
    const record = await this.ensure(org);
    try {
      const next = await this._repository.update(record.id, { slug: checked.slug });
      return this.toEditor(next);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('That username is taken');
      }
      throw error;
    }
  }

  async posts(org: PlanOrg) {
    const record = await this.ensure(org);
    const rows = await this._repository.publishedPosts(org.id);
    return rows.map((post) => this.postCard(post, record.timezone));
  }

  async saveBlock(org: PlanOrg, id: string | null, body: SaveLinkBlockDto) {
    const record = await this.ensure(org);
    const current = id ? await this.requireBlock(record.id, id) : null;
    const type = current ? current.type : body.type;
    if (!type) {
      throw new BadRequestException('Choose a block type');
    }
    if (!id && type === 'EMAIL_CAPTURE') {
      const existing = record.blocks.find((block) => block.type === 'EMAIL_CAPTURE');
      if (existing) {
        return this.toEditor(record);
      }
    }
    if (!id && (await this._repository.countBlocks(record.id)) >= LINK_BLOCK_CAP) {
      throw new BadRequestException('This page has reached the block limit');
    }
    if (!id && type === 'LINK' && (!(body.title || '').trim() || !(body.url || '').trim())) {
      throw new BadRequestException('Add a title and URL');
    }
    if (!id && type === 'HEADING' && !(body.title || '').trim()) {
      throw new BadRequestException('Add a heading');
    }
    if (!id && type === 'FEATURED_POST' && !body.postId) {
      throw new BadRequestException('Pick a published post');
    }
    if (!id && type === 'EMBED' && embedProblem(body.url || '')) {
      throw new BadRequestException(embedProblem(body.url || ''));
    }
    if (!id && type === 'TEXT' && !(body.body || '').trim()) {
      throw new BadRequestException('Add some text');
    }
    if (!id && type === 'FAQ' && !normalizeFaq(body.faq || []).length) {
      throw new BadRequestException('Add at least one question');
    }
    if (!id && type === 'IMAGE_CAROUSEL' && !normalizeImages({ images: body.images || [] }).length) {
      throw new BadRequestException('Add at least one image');
    }
    if (!id && type === 'CONTACT_FORM' && !(body.title || '').trim()) {
      throw new BadRequestException('Add a heading');
    }
    const data = await this.blockData(org.id, record.timezone, type, body, record.organization.subscription, current);
    const block = id
      ? await this._repository.updateBlock(id, data as Prisma.LinkBlockUpdateInput)
      : await this._repository.createBlock({
          pageId: record.id,
          type: type as Prisma.LinkBlockUncheckedCreateInput['type'],
          position: record.blocks.length,
          payload: {},
          ...(data as Prisma.LinkBlockUncheckedCreateInput),
        });
    if (data.priority && type === 'LINK') {
      await this._repository.clearPriority(record.id, block.id);
      await this._repository.moveBlock(record.id, block.id, 'above');
    } else if ((body.placement === 'above' || body.placement === 'below') && type === 'EMAIL_CAPTURE') {
      await this._repository.moveBlock(record.id, block.id, body.placement);
    }
    return this.toEditor(await this.requirePage(org.id));
  }

  async deleteBlock(org: PlanOrg, id: string) {
    const record = await this.ensure(org);
    await this.requireBlock(record.id, id);
    await this._repository.updateBlock(id, { deletedAt: new Date(), priority: false });
    return this.toEditor(await this.requirePage(org.id));
  }

  async reorder(org: PlanOrg, ids: string[]) {
    const record = await this.ensure(org);
    const ok = await this._repository.reorder(record.id, ids);
    if (!ok) {
      throw new BadRequestException('Refresh the page and try the new order again');
    }
    return this.toEditor(await this.requirePage(org.id));
  }

  async analytics(org: PlanOrg, range: string, from = '', to = '') {
    const record = await this.ensure(org);
    const paid = isPaidPlan(record.organization.subscription);
    const custom = from || to ? customWindow(from, to) : null;
    if ((from || to) && !paid) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'deepAnalytics'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if ((from || to) && !custom) {
      throw new BadRequestException('Choose a valid date range');
    }
    const window = custom || rangeWindow(range);
    const report = await this.analyticsReport(record, window);
    return {
      range: custom ? 'custom' : range === '7d' || range === '90d' || range === '12m' ? range : '30d',
      from: custom ? from : null,
      to: custom ? to : null,
      ...report.summary,
      deep: paid ? report.deep : null,
    };
  }

  async exportAnalytics(org: PlanOrg, range: string, from = '', to = '') {
    const record = await this.ensure(org);
    if (!isPaidPlan(record.organization.subscription)) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'deepAnalytics'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    const custom = from || to ? customWindow(from, to) : null;
    if ((from || to) && !custom) {
      throw new BadRequestException('Choose a valid date range');
    }
    const report = await this.analyticsReport(record, custom || rangeWindow(range));
    return analyticsToCsv(report.deep);
  }

  async leads(org: PlanOrg, status: string, query: string) {
    const record = await this.ensure(org);
    const [counts, rows] = await Promise.all([
      this._repository.leadCounts(record.id),
      this._repository.leads(record.id, status, query.trim().toLowerCase(), 500),
    ]);
    const confirmed = counts.find((row) => row.status === 'CONFIRMED')?._count._all || 0;
    const pending = counts.find((row) => row.status === 'PENDING')?._count._all || 0;
    return {
      counts: { all: confirmed + pending, confirmed, pending },
      leads: rows.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        country: countryName(lead.country) || lead.country,
        source: lead.sourceBlock || 'Email capture',
        status: lead.status,
        kind: lead.kind || 'subscribe',
        message: lead.message || '',
        createdAt: lead.createdAt.toISOString(),
      })),
    };
  }

  async exportLeads(org: PlanOrg, status: string, query: string) {
    const record = await this.ensure(org);
    const rows = await this._repository.leads(record.id, status, query.trim().toLowerCase(), 10000);
    return leadsToCsv(
      rows.map((lead) => ({
        email: lead.email,
        capturedAt: lead.createdAt.toISOString(),
        sourceBlock: lead.sourceBlock || 'Email capture',
        slug: record.slug,
        country: countryName(lead.country) || lead.country,
        referrer: lead.referrer,
        kind: lead.kind || 'subscribe',
        message: lead.message || '',
      }))
    );
  }

  async integrations(org: PlanOrg, body: UpdateLinkIntegrationsDto) {
    const record = await this.ensure(org);
    const paid = isPaidPlan(record.organization.subscription);
    const writesSecret =
      !!body.mailchimpKey ||
      !!body.convertkitKey ||
      !!body.webhookUrl ||
      !!body.webhookSecret ||
      body.mailchimpAudience !== undefined ||
      body.convertkitForm !== undefined;
    if (!paid && writesSecret && !body.clearMailchimp && !body.clearConvertkit && !body.clearWebhook) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'integrations'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (!paid && (body.mailchimpKey || body.convertkitKey || body.webhookUrl || body.webhookSecret)) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'integrations'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (body.webhookUrl && !body.clearWebhook) {
      const problem = webhookProblem(body.webhookUrl);
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    const next = await this._repository.update(record.id, {
      ...(body.clearMailchimp
        ? { mailchimpKey: '', mailchimpAudience: '' }
        : {
            ...(body.mailchimpKey ? { mailchimpKey: sealIntegrationSecret(body.mailchimpKey.trim()) } : {}),
            ...(body.mailchimpAudience !== undefined ? { mailchimpAudience: body.mailchimpAudience.trim() } : {}),
          }),
      ...(body.clearConvertkit
        ? { convertkitKey: '', convertkitForm: '' }
        : {
            ...(body.convertkitKey ? { convertkitKey: sealIntegrationSecret(body.convertkitKey.trim()) } : {}),
            ...(body.convertkitForm !== undefined ? { convertkitForm: body.convertkitForm.trim() } : {}),
          }),
      ...(body.clearWebhook
        ? { leadWebhookUrl: '', leadWebhookSecret: '' }
        : {
            ...(body.webhookUrl !== undefined ? { leadWebhookUrl: body.webhookUrl.trim() } : {}),
            ...(body.webhookSecret ? { leadWebhookSecret: sealIntegrationSecret(body.webhookSecret.trim()) } : {}),
          }),
    });
    return this.toEditor(next);
  }

  async connectDomain(org: PlanOrg, domain: string) {
    const record = await this.ensure(org);
    if (!hasCustomDomainAddon(record.organization)) {
      throw new HttpException(
        { message: 'Custom domains are a separate add-on', upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (!this._cloudflare.configured()) {
      return { available: false, page: await this.toEditor(record) };
    }
    const hostname = domain.trim().toLowerCase().replace(/\.$/, '');
    const problem = domainProblem(hostname);
    if (problem) {
      throw new BadRequestException(problem);
    }
    const created = await this._cloudflare.create(hostname);
    if (!created.available) {
      return { available: false, page: await this.toEditor(record) };
    }
    if (!created.ok) {
      const next = await this._repository.update(record.id, {
        customDomain: hostname,
        domainStatus: 'ERROR',
        domainError: created.error,
        domainCheckedAt: new Date(),
      });
      return { available: true, page: await this.toEditor(next) };
    }
    const next = await this._repository.update(record.id, {
      customDomain: hostname,
      domainHostnameId: created.id,
      domainStatus: created.status,
      domainError: '',
      domainTxtName: created.txtName,
      domainTxtValue: created.txtValue,
      domainCheckedAt: new Date(),
    });
    return { available: true, page: await this.toEditor(next) };
  }

  async checkDomain(org: PlanOrg) {
    const record = await this.ensure(org);
    if (!record.domainHostnameId) {
      return { available: this._cloudflare.configured(), page: await this.toEditor(record) };
    }
    if (!this._cloudflare.configured()) {
      return { available: false, page: await this.toEditor(record) };
    }
    const remote = await this._cloudflare.get(record.customDomain || '', record.domainHostnameId);
    if (!remote.available) {
      return { available: false, page: await this.toEditor(record) };
    }
    const next = await this._repository.update(record.id, {
      domainStatus: remote.ok ? remote.status : 'ERROR',
      domainError: remote.ok ? '' : remote.error,
      domainTxtName: remote.txtName || record.domainTxtName,
      domainTxtValue: remote.txtValue || record.domainTxtValue,
      domainCheckedAt: new Date(),
    });
    return { available: true, page: await this.toEditor(next) };
  }

  async removeDomain(org: PlanOrg) {
    const record = await this.ensure(org);
    if (record.domainHostnameId) {
      if (!this._cloudflare.configured()) {
        return { available: false, page: await this.toEditor(record) };
      }
      const removed = await this._cloudflare.remove(record.domainHostnameId);
      if (!removed.available || !removed.ok) {
        throw new BadRequestException('Cloudflare could not remove this domain');
      }
    }
    const next = await this._repository.update(record.id, {
      customDomain: null,
      domainHostnameId: '',
      domainStatus: 'NONE',
      domainError: '',
      domainTxtName: '',
      domainTxtValue: '',
      domainCheckedAt: new Date(),
    });
    return { available: true, page: await this.toEditor(next) };
  }

  async qr(org: PlanOrg, format: 'png' | 'svg') {
    const QRCode = await import('qrcode');
    const record = await this.ensure(org);
    const url = pageUrl(record.slug, record.customDomain || '', record.domainStatus);
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 512 });
      return Buffer.from(svg);
    }
    return QRCode.toBuffer(url, { type: 'png', margin: 1, width: 512 });
  }

  async publicBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (slugProblem(normalized)) {
      return null;
    }
    const record = await this._repository.findBySlug(normalized);
    if (!record) {
      return null;
    }
    return this.toPublic(record);
  }

  async publicByHost(host: string) {
    const hostname = host.trim().toLowerCase().replace(/:\d+$/, '');
    if (domainProblem(hostname)) {
      return null;
    }
    const record = await this._repository.findByDomain(hostname);
    if (!record || record.domainStatus !== 'LIVE') {
      return null;
    }
    return this.toPublic(record);
  }

  async track(kind: 'VIEW' | 'CLICK', body: PublicLinkTrackDto, countryHeader: string, userAgent = '') {
    const record = await this._repository.findBySlug(body.slug.trim().toLowerCase());
    if (!record || !record.isPublic || record.organization.deletedAt) {
      return { ok: true };
    }
    if (kind === 'CLICK') {
      const block = record.blocks.find((item) => item.id === body.blockId && blockState(item) === 'live');
      if (!block) {
        return { ok: true };
      }
    }
    const now = new Date();
    const client = clientLabel(userAgent);
    const utm = captureUtm(body);
    await this._repository.insertEvent({
      pageId: record.id,
      blockId: kind === 'CLICK' ? body.blockId : null,
      type: kind,
      country: cleanCountry(countryHeader),
      source: sourceLabel(body),
      referrer: sanitizeReferrer(body.referrer || ''),
      device: client.device,
      browser: client.browser,
      ...utm,
      day: utcDay(now),
    });
    return { ok: true };
  }

  async subscribe(body: PublicLinkSubscribeDto, countryHeader: string) {
    const record = await this._repository.findBySlug(body.slug.trim().toLowerCase());
    const block = record?.blocks.find((item) => item.type === 'EMAIL_CAPTURE' && blockState(item) === 'live');
    if (!record || !record.isPublic || !block) {
      throw new NotFoundException('This page is not collecting emails');
    }
    const problem = emailProblem(body.email || '');
    if (problem) {
      throw new BadRequestException(problem);
    }
    const email = body.email.trim().toLowerCase();
    const existing = await this._repository.findLead(record.id, email);
    if (existing?.status === 'CONFIRMED') {
      return { status: 'confirmed' as const, already: true };
    }
    if (existing?.status === 'PENDING') {
      return { status: 'pending' as const, already: true };
    }
    const token = record.captureDoubleOptIn ? randomBytes(24).toString('hex') : null;
    await this._repository.createLead({
      pageId: record.id,
      blockId: block.id,
      email,
      name: record.captureAskName ? (body.name || '').trim().slice(0, 80) : '',
      country: cleanCountry(countryHeader),
      referrer: sanitizeReferrer(body.referrer || ''),
      sourceBlock: block.title || 'Email capture',
      status: record.captureDoubleOptIn ? 'PENDING' : 'CONFIRMED',
      confirmToken: token,
    });
    let emailed = false;
    if (token) {
      const origin = (process.env.FRONTEND_URL || publicOrigin()).replace(/\/$/, '');
      emailed = await this._email.sendEmailSync(
        email,
        `Confirm your email for ${record.name || record.slug}`,
        `<p>Confirm you want email from ${this.escape(record.name || record.slug)}.</p><p><a href="${origin}/subscribe/confirm/${token}">Confirm email</a></p>`
      );
    }
    if (record.captureNotify && !record.captureDoubleOptIn) {
      await this.notify(record, email);
    }
    if (!record.captureDoubleOptIn) {
      await this.fanout(record, { email, name: record.captureAskName ? (body.name || '').trim() : '', source: block.title || 'Email capture', kind: 'subscribe' });
    }
    return { status: record.captureDoubleOptIn ? ('pending' as const) : ('confirmed' as const), emailed };
  }

  async confirm(token: string) {
    const lead = await this._repository.findLeadByToken(token);
    if (!lead) {
      return null;
    }
    await this._repository.confirmLead(token);
    if (lead.page) {
      const record = await this._repository.findBySlug(lead.page.slug);
      if (record?.captureNotify) {
        await this.notify(record, lead.email);
      }
      if (record) {
        await this.fanout(record, {
          email: lead.email,
          name: lead.name,
          source: lead.sourceBlock || 'Email capture',
          kind: lead.kind || 'subscribe',
        });
      }
    }
    return { slug: lead.page.slug, name: lead.page.name };
  }

  async unlock(body: PublicLinkUnlockDto, countryHeader: string) {
    const record = await this._repository.findBySlug(body.slug.trim().toLowerCase());
    const block = record?.blocks.find((item) => item.id === body.blockId && item.type === 'LINK' && blockState(item) === 'live');
    if (!record || !record.isPublic || !block || block.lockType === 'NONE') {
      throw new NotFoundException('This link is not locked');
    }
    if (block.lockType === 'AGE') {
      if (!body.age) {
        throw new BadRequestException('Confirm you are 18 or older');
      }
      return { url: block.url };
    }
    if (block.lockType === 'EMAIL') {
      const problem = emailProblem(body.email || '');
      if (problem) {
        throw new BadRequestException(problem);
      }
      const email = (body.email || '').trim().toLowerCase();
      const existing = await this._repository.findLead(record.id, email);
      if (!existing) {
        try {
          await this._repository.createLead({
            pageId: record.id,
            blockId: block.id,
            email,
            name: (body.name || '').trim().slice(0, 80),
            country: cleanCountry(countryHeader),
            referrer: sanitizeReferrer(body.referrer || ''),
            sourceBlock: block.title || 'Locked link',
            message: '',
            kind: 'unlock',
            status: 'CONFIRMED',
            confirmToken: null,
          });
          await this.fanout(record, { email, name: (body.name || '').trim(), source: block.title || 'Locked link', kind: 'unlock' });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
            throw error;
          }
        }
      }
      return { url: block.url };
    }
    if (!body.password || !block.lockHash || !AuthService.comparePassword(body.password, block.lockHash)) {
      throw new BadRequestException('That password is not right');
    }
    return { url: block.url };
  }

  async contact(body: PublicLinkContactDto, countryHeader: string) {
    const record = await this._repository.findBySlug(body.slug.trim().toLowerCase());
    const block = record?.blocks.find(
      (item) => item.id === body.blockId && item.type === 'CONTACT_FORM' && blockState(item) === 'live'
    );
    if (!record || !record.isPublic || !block) {
      throw new NotFoundException('This form is not available');
    }
    const decision = contactDecision(body);
    if (decision === 'drop') {
      return { ok: true };
    }
    if (decision === 'invalid') {
      throw new BadRequestException('Check the email and message');
    }
    const email = body.email.trim().toLowerCase();
    const message = body.message.trim().slice(0, 2000);
    const name = (body.name || '').trim().slice(0, 80);
    const existing = await this._repository.findLead(record.id, email);
    if (existing) {
      await this._repository.updateLead(existing.id, { message, ...(name ? { name } : {}) });
      return { ok: true, already: true };
    }
    try {
      await this._repository.createLead({
        pageId: record.id,
        blockId: block.id,
        email,
        name,
        country: cleanCountry(countryHeader),
        referrer: sanitizeReferrer(body.referrer || ''),
        sourceBlock: block.title || 'Contact form',
        message,
        kind: 'contact',
        status: 'CONFIRMED',
        confirmToken: null,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const again = await this._repository.findLead(record.id, email);
      if (again) {
        await this._repository.updateLead(again.id, { message, ...(name ? { name } : {}) });
      }
      return { ok: true, already: true };
    }
    await this.fanout(record, { email, name, source: block.title || 'Contact form', kind: 'contact' });
    return { ok: true };
  }

  private async analyticsReport(
    record: LinkPageRecord,
    window: { from: Date; to: Date; previousFrom: Date }
  ) {
    const paid = isPaidPlan(record.organization.subscription);
    const [views, clicks, subscribers, previousViews, previousClicks, previousSubscribers, series, countries, sources, linkClicks, devices, browsers, utm] =
      await Promise.all([
        this._repository.countEvents(record.id, 'VIEW', window.from, window.to),
        this._repository.countEvents(record.id, 'CLICK', window.from, window.to),
        this._repository.countSubscribers(record.id, window.from, window.to),
        this._repository.countEvents(record.id, 'VIEW', window.previousFrom, window.from),
        this._repository.countEvents(record.id, 'CLICK', window.previousFrom, window.from),
        this._repository.countSubscribers(record.id, window.previousFrom, window.from),
        this._repository.series(record.id, utcDay(window.from), utcDay(window.to)),
        this._repository.grouped(record.id, 'country', window.from, window.to),
        this._repository.grouped(record.id, 'source', window.from, window.to),
        this._repository.clicksByBlock(record.id, window.from, window.to),
        paid ? this._repository.grouped(record.id, 'device', window.from, window.to) : Promise.resolve([]),
        paid ? this._repository.grouped(record.id, 'browser', window.from, window.to) : Promise.resolve([]),
        paid ? this._repository.utmBreakdown(record.id, window.from, window.to) : Promise.resolve([]),
      ]);
    const clicksById = new Map(linkClicks.filter((row) => row.blockId).map((row) => [row.blockId || '', row._count._all]));
    const summary = buildAnalytics({
      views,
      clicks,
      subscribers,
      previousViews,
      previousClicks,
      previousSubscribers,
      series: fillDays(
        window.from,
        window.to,
        series.map((row) => ({ day: row.day, type: row.type, count: row._count._all }))
      ),
      links: linkClicks
        .filter((row) => row.blockId)
        .map((row) => ({
          id: row.blockId || '',
          title: record.blocks.find((block) => block.id === row.blockId)?.title || 'Deleted link',
          clicks: row._count._all,
        })),
      countries: countries
        .filter((row) => row.country)
        .map((row) => ({ code: row.country, views: row._count._all })),
      sources: sources.map((row) => ({ source: row.source, views: row._count._all })),
    });
    const links = record.blocks
      .filter((block) => block.type === 'LINK')
      .map((block) => ({
        id: block.id,
        title: block.title || 'Link',
        clicks: clicksById.get(block.id) || 0,
        ctr: views ? ((clicksById.get(block.id) || 0) / views) * 100 : 0,
      }));
    const utmRows = utm
      .map((row) => ({
        label: [row.utmSource, row.utmMedium, row.utmCampaign].filter(Boolean).join(' / '),
        views: row._count._all,
      }))
      .filter((row) => row.label);
    return {
      summary,
      deep: {
        links,
        devices: shareRows(devices.map((row) => ({ label: row.device, views: row._count._all }))),
        browsers: shareRows(browsers.map((row) => ({ label: row.browser, views: row._count._all }))),
        utm: shareRows(utmRows),
      },
    };
  }

  private hint(stored: string) {
    if (!stored) {
      return '';
    }
    try {
      return secretHint(openIntegrationSecret(stored));
    } catch {
      return '';
    }
  }

  private async fanout(
    record: LinkPageRecord,
    lead: { email: string; name: string; source: string; kind: string }
  ) {
    if (!isPaidPlan(record.organization.subscription)) {
      return;
    }
    const jobs: Array<Promise<unknown>> = [];
    if (record.mailchimpKey && record.mailchimpAudience) {
      jobs.push(this.pushMailchimp(record, lead));
    }
    if (record.convertkitKey && record.convertkitForm) {
      jobs.push(this.pushConvertkit(record, lead));
    }
    if (record.leadWebhookUrl) {
      jobs.push(this.pushWebhook(record, lead));
    }
    await Promise.allSettled(jobs);
  }

  private async pushMailchimp(record: LinkPageRecord, lead: { email: string; name: string }) {
    const key = openIntegrationSecret(record.mailchimpKey);
    const datacenter = key.split('-').pop() || '';
    if (!/^[a-z0-9]+$/i.test(datacenter)) {
      return;
    }
    const response = await fetch(
      `https://${datacenter}.api.mailchimp.com/3.0/lists/${encodeURIComponent(record.mailchimpAudience)}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`crea8:${key}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: lead.email,
          status: 'subscribed',
          merge_fields: lead.name ? { FNAME: lead.name.slice(0, 80) } : {},
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok && response.status !== 400) {
      return;
    }
  }

  private async pushConvertkit(record: LinkPageRecord, lead: { email: string; name: string }) {
    const key = openIntegrationSecret(record.convertkitKey);
    await fetch(`https://api.convertkit.com/v3/forms/${encodeURIComponent(record.convertkitForm)}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        email: lead.email,
        first_name: lead.name.slice(0, 80),
      }),
      signal: AbortSignal.timeout(8000),
    });
  }

  private async pushWebhook(record: LinkPageRecord, lead: { email: string; name: string; source: string; kind: string }) {
    if (webhookProblem(record.leadWebhookUrl)) {
      return;
    }
    const payload = JSON.stringify({
      event: 'lead.created',
      email: lead.email,
      name: lead.name,
      source: lead.source,
      kind: lead.kind,
      slug: record.slug,
      createdAt: new Date().toISOString(),
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (record.leadWebhookSecret) {
      const secret = openIntegrationSecret(record.leadWebhookSecret);
      headers['X-Crea8-Signature'] = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    }
    await fetch(record.leadWebhookUrl, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
  }

  private async notify(record: LinkPageRecord, email: string) {
    const owner = await this._repository.ownerEmail(record.organizationId);
    if (!owner) {
      return;
    }
    await this._email.sendEmailSync(
      owner,
      `New subscriber on crea8.one/${record.slug}`,
      `<p>${this.escape(email)} subscribed on crea8.one/${this.escape(record.slug)}.</p>`
    );
  }

  private async ensure(org: PlanOrg, timezone?: string) {
    const existing = await this._repository.findByOrg(org.id);
    if (existing) {
      return existing;
    }
    let slug = suggestSlug(org.name || '', org.id);
    for (let attempt = 0; attempt < 6; attempt++) {
      const owner = await this._repository.slugOwner(slug);
      if (!owner) {
        break;
      }
      slug = `${suggestSlug(org.name || '', org.id).slice(0, 24)}${attempt + 2}`.slice(0, 30);
    }
    try {
      return await this._repository.create({
        organizationId: org.id,
        slug,
        name: (org.name || slug).slice(0, 80),
        timezone: timezone && isValidTimeZone(timezone) ? timezone : 'Asia/Kolkata',
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this._repository.findByOrg(org.id);
        if (again) {
          return again;
        }
      }
      throw error;
    }
  }

  private async requirePage(organizationId: string) {
    const record = await this._repository.findByOrg(organizationId);
    if (!record) {
      throw new NotFoundException('Page not found');
    }
    return record;
  }

  private async requireBlock(pageId: string, id: string) {
    const block = await this._repository.findBlock(pageId, id);
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    return block;
  }

  private async blockData(
    orgId: string,
    timeZone: string,
    type: string,
    body: SaveLinkBlockDto,
    subscription: LinkPageRecord['organization']['subscription'],
    current: { lockHash: string; lockType: string; spotlight: boolean } | null
  ) {
    const title = (body.title || '').trim();
    const url = (body.url || '').trim();
    if (type === 'LINK') {
      if (body.title !== undefined && !title) {
        throw new BadRequestException('Add a title');
      }
      if (body.url !== undefined && !url) {
        throw new BadRequestException('Add a URL');
      }
      if (url && urlProblem(url)) {
        throw new BadRequestException(urlProblem(url));
      }
    }
    if (type === 'HEADING' && body.title !== undefined && !title) {
      throw new BadRequestException('Add a heading');
    }
    if (type === 'EMBED' && body.url !== undefined && embedProblem(url)) {
      throw new BadRequestException(embedProblem(url));
    }
    if (type === 'TEXT' && body.body !== undefined && !(body.body || '').trim()) {
      throw new BadRequestException('Add some text');
    }
    if (body.thumbnail && imagePathProblem(body.thumbnail)) {
      throw new BadRequestException('Use an uploaded image');
    }
    const paid = isPaidPlan(subscription);
    if (body.spotlight && type === 'LINK' && !paid && !current?.spotlight) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'spotlight'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (
      body.lockType &&
      body.lockType !== 'NONE' &&
      type === 'LINK' &&
      !paid &&
      current?.lockType !== body.lockType
    ) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'lock'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (type === 'LINK' && body.lockType) {
      const problem = lockProblem({
        lockType: body.lockType,
        password: body.password,
        hasHash: !!current?.lockHash && current.lockHash.length > 0,
      });
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    if (type === 'FAQ' && body.faq && !normalizeFaq(body.faq).length) {
      throw new BadRequestException('Add at least one question');
    }
    if (type === 'IMAGE_CAROUSEL' && body.images) {
      for (const image of body.images) {
        const problem = imagePathProblem(image.path);
        if (problem) {
          throw new BadRequestException(problem);
        }
      }
      if (!normalizeImages({ images: body.images }).length) {
        throw new BadRequestException('Add at least one image');
      }
    }
    const lockHash =
      type !== 'LINK' || body.lockType === undefined
        ? undefined
        : body.lockType === 'PASSWORD' && body.password
        ? AuthService.hashPassword(body.password)
        : body.lockType === 'PASSWORD'
        ? undefined
        : '';
    const payload = body.faq
      ? { items: normalizeFaq(body.faq) }
      : body.images
      ? { images: normalizeImages({ images: body.images }) }
      : body.formButton !== undefined || body.formAskName !== undefined
      ? { button: (body.formButton || 'Send').trim() || 'Send', askName: !!body.formAskName }
      : undefined;
    if (type === 'FEATURED_POST' && body.postId) {
      const post = await this._repository.findPost(orgId, body.postId);
      if (!post) {
        throw new BadRequestException('Pick a published post');
      }
    }
    if (type === 'FEATURED_POST' && body.postId === '') {
      throw new BadRequestException('Pick a published post');
    }
    const startsAt = body.startsLocal ? zonedLocalToUtc(body.startsLocal, timeZone) : undefined;
    const endsAt = body.endsLocal ? zonedLocalToUtc(body.endsLocal, timeZone) : undefined;
    if (body.startsLocal && !startsAt) {
      throw new BadRequestException('Choose a valid start time');
    }
    if (body.endsLocal && !endsAt) {
      throw new BadRequestException('Choose a valid end time');
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('The end time has to be after the start');
    }
    return {
      ...(body.title !== undefined ? { title } : {}),
      ...(body.url !== undefined ? { url } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.priority !== undefined ? { priority: type === 'LINK' ? body.priority : false } : {}),
      ...(body.scheduleOn !== undefined ? { scheduleOn: body.scheduleOn } : {}),
      ...(body.startsLocal !== undefined ? { startsAt } : {}),
      ...(body.endsLocal !== undefined ? { endsAt } : {}),
      ...(body.postId ? { postId: body.postId } : {}),
      ...(body.thumbnail !== undefined ? { thumbnail: (body.thumbnail || '').trim() } : {}),
      ...(body.iconMode !== undefined ? { iconMode: type === 'LINK' ? body.iconMode : '' } : {}),
      ...(body.spotlight !== undefined ? { spotlight: type === 'LINK' ? body.spotlight : false } : {}),
      ...(body.body !== undefined ? { body: (body.body || '').trim() } : {}),
      ...(body.lockType !== undefined
        ? { lockType: (type === 'LINK' ? body.lockType : 'NONE') as Prisma.LinkBlockUpdateInput['lockType'] }
        : {}),
      ...(lockHash !== undefined ? { lockHash } : {}),
      ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}),
    };
  }

  private async toEditor(record: LinkPageRecord) {
    const clicks = await this._repository.clickCounts(record.id);
    const byBlock = new Map(clicks.filter((row) => row.blockId).map((row) => [row.blockId, row._count._all]));
    const paid = isPaidPlan(record.organization.subscription);
    const customDomainAddon = hasCustomDomainAddon(record.organization);
    const hostname = record.customDomain || '';
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      bio: record.bio,
      avatarPath: record.avatarPath,
      theme: record.theme,
      buttonStyle: record.buttonStyle,
      font: record.font,
      backgroundMode: record.backgroundMode,
      backgroundColor: record.backgroundColor,
      backgroundImage: record.backgroundImage,
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      isPublic: record.isPublic,
      sensitive: record.sensitive,
      hideBadge: record.hideBadge && paid,
      timezone: record.timezone,
      customDomain: hostname,
      domainStatus: record.domainStatus,
      domainError: record.domainError,
      domainCheckedAt: record.domainCheckedAt ? record.domainCheckedAt.toISOString() : null,
      domainAvailable: this._cloudflare.configured(),
      cnameTarget: this._cloudflare.cnameTarget(),
      domainRecords: hostname
        ? domainRecords({
            hostname,
            cnameTarget: this._cloudflare.cnameTarget(),
            txtName: record.domainTxtName,
            txtValue: record.domainTxtValue,
          })
        : [],
      paid,
      customDomainAddon,
      publicOrigin: publicOrigin(),
      publicUrl: pageUrl(record.slug, hostname, record.domainStatus),
      capture: {
        heading: record.captureHeading,
        button: record.captureButton,
        consent: record.captureConsent,
        askName: record.captureAskName,
        doubleOptIn: record.captureDoubleOptIn,
        notify: record.captureNotify,
      },
      socials: this.socials(record.socials),
      integrations: {
        mailchimp: {
          connected: !!record.mailchimpKey,
          audience: record.mailchimpAudience,
          hint: this.hint(record.mailchimpKey),
        },
        convertkit: {
          connected: !!record.convertkitKey,
          form: record.convertkitForm,
          hint: this.hint(record.convertkitKey),
        },
        webhook: {
          url: record.leadWebhookUrl,
          hasSecret: !!record.leadWebhookSecret,
        },
      },
      blocks: record.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        position: block.position,
        enabled: block.enabled,
        title: block.title,
        url: block.url,
        priority: block.priority,
        scheduleOn: block.scheduleOn,
        startsAt: block.startsAt ? block.startsAt.toISOString() : null,
        endsAt: block.endsAt ? block.endsAt.toISOString() : null,
        postId: block.postId,
        state: blockState(block),
        clicks: byBlock.get(block.id) || 0,
        thumbnail: block.thumbnail,
        iconMode: block.iconMode,
        spotlight: block.spotlight,
        body: block.body,
        lock: { type: block.lockType, hasPassword: !!block.lockHash },
        faq: block.type === 'FAQ' ? normalizeFaq(block.payload) : [],
        images: block.type === 'IMAGE_CAROUSEL' ? normalizeImages(block.payload) : [],
        form: block.type === 'CONTACT_FORM' ? normalizeForm(block) : null,
        post: block.post ? this.postCard(block.post, record.timezone) : null,
      })),
    };
  }

  private toPublic(record: LinkPageRecord) {
    const paid = isPaidPlan(record.organization.subscription);
    const visible = record.isPublic
      ? record.blocks.filter((block) => blockState(block) === 'live').filter((block) => {
          if (block.type !== 'FEATURED_POST') {
            return true;
          }
          return !!block.post && block.post.state === 'PUBLISHED' && !block.post.deletedAt;
        })
      : [];
    const capture = visible.some((block) => block.type === 'EMAIL_CAPTURE');
    return {
      slug: record.slug,
      name: record.name,
      bio: record.bio,
      avatarPath: publicAsset(record.avatarPath),
      theme: record.theme,
      buttonStyle: record.buttonStyle,
      font: record.font,
      backgroundMode: record.backgroundMode,
      backgroundColor: record.backgroundColor,
      backgroundImage: publicAsset(record.backgroundImage),
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      isPublic: record.isPublic,
      sensitive: record.sensitive,
      showBadge: showBadge(record.hideBadge, paid),
      socials: this.socials(record.socials)
        .map((item) => ({ ...item, url: item.url }))
        .filter((item) => !urlProblem(item.url)),
      capture: capture
        ? {
            heading: record.captureHeading,
            button: record.captureButton || 'Subscribe',
            consent: record.captureConsent,
            askName: record.captureAskName,
          }
        : null,
      blocks: visible.map((block) => {
        const view = presentPublicBlock(block, paid);
        return {
          ...view,
          thumbnail: view.thumbnail.startsWith('http') ? view.thumbnail : publicAsset(view.thumbnail),
          images: view.images.map((image) => ({
            ...image,
            path: image.path.startsWith('http') ? image.path : publicAsset(image.path),
          })),
          post: block.post ? this.postCard(block.post, record.timezone, true) : null,
        };
      }),
    };
  }

  private postCard(
    post: {
      id: string;
      title?: string | null;
      content: string;
      publishDate: Date;
      releaseURL?: string | null;
      image?: string | null;
      integration?: { providerIdentifier: string } | null;
    },
    timeZone: string,
    absolute = false
  ) {
    const image = firstImage(post.image);
    const release = post.releaseURL || '';
    const local = `/p/${post.id}`;
    return {
      id: post.id,
      title: post.title || plainText(post.content, 120) || 'Untitled post',
      platform: platformLabel(post.integration?.providerIdentifier || ''),
      dateLabel: shortDate(post.publishDate, timeZone),
      image: absolute ? publicAsset(image) : image,
      url: release || (absolute ? publicAsset(local) : local),
    };
  }

  private socials(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item) => item && typeof item.network === 'string' && typeof item.url === 'string')
      .map((item) => ({ network: String(item.network), url: String(item.url) }))
      .slice(0, 8);
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
