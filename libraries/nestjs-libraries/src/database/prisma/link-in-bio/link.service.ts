import { createHmac, randomBytes } from 'crypto';
import { canonicalizeStoredMedia } from '@gitroom/nestjs-libraries/upload/media.access';
import { deliverStoredMedia } from '@gitroom/nestjs-libraries/upload/media.deliver';
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
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
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
  LINK_PLAN_GATING_ENABLED,
  analyticsToCsv,
  blockState,
  buildAnalytics,
  calendlyProblem,
  captureUtm,
  cleanCountry,
  clientLabel,
  contactDecision,
  countryName,
  customWindow,
  designProKind,
  detailsProblem,
  dobProblem,
  blockPriority,
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
  knownRange,
  leadsToCsv,
  linkDomainOpen,
  linkFeatureOpen,
  linkIsHidden,
  linkProKind,
  lockProblem,
  mapProblem,
  musicProblem,
  restoreBlockProblem,
  latestYoutubeVideoId,
  youtubeChannelIdFromHtml,
  youtubeChannelTarget,
  youtubeWatchEmbed,
  normalizeDesign,
  normalizeDetails,
  normalizeDiscount,
  normalizeEvents,
  normalizeFaq,
  normalizeForm,
  normalizeImages,
  normalizeLinkExtras,
  normalizeVisitor,
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
  themeIsPro,
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
    private _email: EmailService,
    private _integrations: IntegrationManager
  ) {}

  async page(org: PlanOrg, timezone?: string) {
    const record = await this.ensure(org, timezone);
    return this.toEditor(record);
  }

  async update(org: PlanOrg, body: UpdateLinkPageDto) {
    const record = await this.ensure(org);
    if (body.hideBadge && !linkFeatureOpen(record.organization.subscription)) {
      throw new HttpException(
        { message: 'Removing the badge is on a paid plan', upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    const design = body.design
      ? normalizeDesign({ ...(record.design as object), ...body.design, colors: { ...((record.design as { colors?: object })?.colors || {}), ...(body.design.colors || {}) } })
      : undefined;
    if (design) {
      const kind = designProKind(body.theme || record.theme, design);
      if (kind && !linkFeatureOpen(record.organization.subscription)) {
        throw new HttpException({ message: paidFeatureProblem(false, kind), upgrade: true }, HttpStatus.PAYMENT_REQUIRED);
      }
    }
    if (body.theme && themeIsPro(body.theme) && !linkFeatureOpen(record.organization.subscription)) {
      throw new HttpException({ message: paidFeatureProblem(false, 'theme'), upgrade: true }, HttpStatus.PAYMENT_REQUIRED);
    }
    if (body.timezone && !isValidTimeZone(body.timezone)) {
      throw new BadRequestException('Choose a valid timezone');
    }
    const logo = body.design?.logoUrl?.trim();
    if (logo && imagePathProblem(logo)) {
      throw new BadRequestException(imagePathProblem(logo));
    }
    const media = body.design?.mediaUrl?.trim();
    if (media && imagePathProblem(media)) {
      throw new BadRequestException(imagePathProblem(media));
    }
    const socials = body.socials
      ? body.socials.flatMap((item) => {
          const url = item.url.trim();
          if (!url) {
            return [];
          }
          const problem = urlProblem(url);
          if (problem) {
            throw new BadRequestException(problem);
          }
          return [{ network: item.network, url }];
        })
      : undefined;
    const next = await this._repository.update(record.id, {
      ...(body.name !== undefined ? { name: body.name.trim().slice(0, 30) } : {}),
      ...(body.bio !== undefined ? { bio: body.bio.trim() } : {}),
      ...(body.avatarPath !== undefined
        ? { avatarPath: canonicalizeStoredMedia(body.avatarPath.trim()) }
        : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.buttonStyle !== undefined ? { buttonStyle: body.buttonStyle } : {}),
      ...(body.font !== undefined ? { font: body.font } : {}),
      ...(body.backgroundMode !== undefined ? { backgroundMode: body.backgroundMode } : {}),
      ...(body.backgroundColor !== undefined ? { backgroundColor: body.backgroundColor.trim() } : {}),
      ...(body.backgroundImage !== undefined
        ? { backgroundImage: canonicalizeStoredMedia(body.backgroundImage.trim()) }
        : {}),
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
      ...(design ? { design: design as Prisma.InputJsonValue } : {}),
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
    return Promise.all(
      rows.map(async (post) => {
        const card = this.postCard(post, record.timezone);
        return { ...card, image: await this.readable(card.image, 'private') };
      })
    );
  }

  async saveBlock(org: PlanOrg, id: string | null, body: SaveLinkBlockDto) {
    const record = await this.ensure(org);
    const current = id ? await this.requireBlock(record.id, id) : null;
    const type = current ? current.type : body.type;
    if (!type) {
      throw new BadRequestException('Choose a block type');
    }
    if (type === 'EMBED' && body.url) {
      body.url = await this.canonicalTikTok(body.url);
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
    if (!id && type === 'MUSIC' && musicProblem(body.url || '')) {
      throw new BadRequestException(musicProblem(body.url || ''));
    }
    if (!id && type === 'LATEST_YOUTUBE' && !youtubeChannelTarget(body.url || '')) {
      throw new BadRequestException('Use a YouTube channel link');
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
    if (!id && type === 'MAP' && mapProblem(body.url || '')) {
      throw new BadRequestException(mapProblem(body.url || ''));
    }
    if (!id && type === 'CALENDLY' && calendlyProblem(body.url || '')) {
      throw new BadRequestException(calendlyProblem(body.url || ''));
    }
    if (!id && type === 'CONTACT_DETAILS' && detailsProblem(normalizeDetails({ details: this.detailInput(body) }))) {
      throw new BadRequestException('Add at least one contact detail');
    }
    if (!id && type === 'DISCOUNT' && !(body.discountCode || body.title || '').trim()) {
      throw new BadRequestException('Add a discount code');
    }
    if (!id && type === 'EVENTS' && !normalizeEvents({ events: body.events || [] }).length) {
      throw new BadRequestException('Add at least one event');
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
    if (type !== 'LINK' && data.priority === true) {
      await this._repository.clearPriority(record.id, block.id);
    }
    if (type === 'LINK') {
      const extras = normalizeLinkExtras(data.payload || current?.payload);
      if (extras.animation !== 'none' || (extras.priorityMode !== 'none' && data.priority !== false)) {
        await this.quietOthers(record.id, block.id, {
          animation: extras.animation !== 'none',
          focus: extras.priorityMode !== 'none',
        });
      }
      if (data.priority && extras.priorityMode !== 'none') {
        await this._repository.moveBlock(record.id, block.id, 'above');
      }
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

  async restoreBlock(org: PlanOrg, id: string) {
    const record = await this.ensure(org);
    const block = await this._repository.findDeletedBlock(record.id, id);
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    const problem = restoreBlockProblem(
      block.type,
      record.blocks.map((item) => item.type)
    );
    if (problem) {
      throw new BadRequestException(problem);
    }
    await this._repository.updateBlock(id, { deletedAt: null });
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
    const open = linkFeatureOpen(record.organization.subscription);
    const custom = from || to ? customWindow(from, to) : null;
    if ((from || to) && !open) {
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
      range: custom ? 'custom' : knownRange(range),
      from: custom ? from : null,
      to: custom ? to : null,
      ...report.summary,
      deep: open ? report.deep : null,
    };
  }

  async exportAnalytics(org: PlanOrg, range: string, from = '', to = '') {
    const record = await this.ensure(org);
    if (!linkFeatureOpen(record.organization.subscription)) {
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
    const paid = linkFeatureOpen(record.organization.subscription);
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
    if (!linkDomainOpen(record.organization)) {
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

  async publicSlugs() {
    const rows = await this._repository.publicSlugs();
    return {
      slugs: rows.map((row) => row.slug).filter((slug) => !slugProblem(slug)),
    };
  }

  async publicBySlug(slug: string, visitor?: { country?: string; language?: string; platform?: string; referrer?: string }) {
    const normalized = slug.trim().toLowerCase();
    if (slugProblem(normalized)) {
      return null;
    }
    const record = await this._repository.findBySlug(normalized);
    if (!record) {
      return null;
    }
    return this.toPublic(record, normalizeVisitor(visitor || {}));
  }

  async publicByHost(host: string, visitor?: { country?: string; language?: string; platform?: string; referrer?: string }) {
    const hostname = host.trim().toLowerCase().replace(/:\d+$/, '');
    if (domainProblem(hostname)) {
      return null;
    }
    const record = await this._repository.findByDomain(hostname);
    if (!record || record.domainStatus !== 'LIVE') {
      return null;
    }
    return this.toPublic(record, normalizeVisitor(visitor || {}));
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
    if (block.lockType === 'DOB') {
      const problem = dobProblem(body.dob || '', normalizeLinkExtras(block.payload).minAge);
      if (problem) {
        throw new BadRequestException(problem);
      }
      return { url: block.url };
    }
    if (block.lockType === 'SENSITIVE') {
      if (!body.sensitive) {
        throw new BadRequestException('Confirm you want to view this');
      }
      return { url: block.url };
    }
    if (block.lockType === 'CODE') {
      if (!body.password || !block.lockHash || !AuthService.comparePassword(body.password, block.lockHash)) {
        throw new BadRequestException('That code is not right');
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
    const paid = linkFeatureOpen(record.organization.subscription);
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
    if (!linkFeatureOpen(record.organization.subscription)) {
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
        name: (org.name || slug).slice(0, 30),
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
    current: { lockHash: string; lockType: string; spotlight: boolean; payload?: unknown } | null
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
    if (type === 'MUSIC' && body.url !== undefined && musicProblem(url)) {
      throw new BadRequestException(musicProblem(url));
    }
    if (type === 'LATEST_YOUTUBE' && body.url !== undefined && !youtubeChannelTarget(url)) {
      throw new BadRequestException('Use a YouTube channel link');
    }
    if (type === 'MAP' && body.url !== undefined && mapProblem(url)) {
      throw new BadRequestException(mapProblem(url));
    }
    if (type === 'CALENDLY' && body.url !== undefined && calendlyProblem(url)) {
      throw new BadRequestException(calendlyProblem(url));
    }
    if (type === 'TEXT' && body.body !== undefined && !(body.body || '').trim()) {
      throw new BadRequestException('Add some text');
    }
    if (body.thumbnail && imagePathProblem(body.thumbnail)) {
      throw new BadRequestException('Use an uploaded image');
    }
    const open = linkFeatureOpen(subscription);
    if (body.spotlight && type === 'LINK' && !open && !current?.spotlight) {
      throw new HttpException(
        { message: paidFeatureProblem(false, 'spotlight'), upgrade: true },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    if (
      body.lockType &&
      body.lockType !== 'NONE' &&
      type === 'LINK' &&
      !open &&
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
    const currentExtras = normalizeLinkExtras(current?.payload);
    const priorityMode =
      body.priorityMode ||
      (body.priority === true ? 'highlight' : body.priority === false ? 'none' : currentExtras.priorityMode);
    const nextExtras = normalizeLinkExtras({
      ...currentExtras,
      ...(body.layout ? { layout: body.layout } : {}),
      ...(body.animation ? { animation: body.animation } : {}),
      priorityMode,
      ...(body.rules ? { rules: body.rules } : { rules: currentExtras.rules }),
      ...(body.minAge !== undefined ? { minAge: body.minAge } : { minAge: currentExtras.minAge }),
    });
    if (type === 'LINK') {
      const kind = linkProKind(nextExtras);
      if (kind && kind !== linkProKind(currentExtras) && !open) {
        throw new HttpException({ message: paidFeatureProblem(false, kind), upgrade: true }, HttpStatus.PAYMENT_REQUIRED);
      }
      const nextLock = body.lockType || current?.lockType || 'NONE';
      if (nextExtras.priorityMode === 'redirect' && nextLock !== 'NONE') {
        throw new BadRequestException("A redirect link can't be locked");
      }
    }
    if (type === 'CONTACT_DETAILS' && (body.detailEmail !== undefined || body.detailPhone !== undefined || body.detailAddress !== undefined || body.detailWebsite !== undefined)) {
      const problem = detailsProblem(normalizeDetails({ details: this.detailInput(body) }));
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    if (type === 'DISCOUNT' && body.discountCode !== undefined && !(body.discountCode || '').trim()) {
      throw new BadRequestException('Add a discount code');
    }
    if (type === 'EVENTS' && body.events && !normalizeEvents({ events: body.events }).length) {
      throw new BadRequestException('Add at least one event');
    }
    const lockHash =
      type !== 'LINK' || body.lockType === undefined
        ? undefined
        : (body.lockType === 'PASSWORD' || body.lockType === 'CODE') && body.password
        ? AuthService.hashPassword(body.password)
        : body.lockType === 'PASSWORD' || body.lockType === 'CODE'
        ? undefined
        : '';
    const linkTouched =
      type === 'LINK' &&
      (body.layout !== undefined ||
        body.animation !== undefined ||
        body.priorityMode !== undefined ||
        body.priority !== undefined ||
        body.rules !== undefined ||
        body.minAge !== undefined);
    const payload = body.faq
      ? { items: normalizeFaq(body.faq) }
      : body.images
      ? {
          images: normalizeImages({
            images: body.images.map((image) => ({
              ...image,
              path: canonicalizeStoredMedia(image.path || ''),
            })),
          }),
        }
      : body.formButton !== undefined || body.formAskName !== undefined
      ? { button: (body.formButton || 'Send').trim() || 'Send', askName: !!body.formAskName }
      : type === 'CONTACT_DETAILS' && (body.detailEmail !== undefined || !current)
      ? { details: normalizeDetails({ details: this.detailInput(body) }) }
      : type === 'DISCOUNT' && (body.discountCode !== undefined || !current)
      ? { discount: normalizeDiscount({ title: body.discountCode || title, url, body: body.discountNote || body.body, payload: { code: body.discountCode || title, note: body.discountNote || body.body || '', url } }) }
      : type === 'EVENTS' && body.events
      ? { events: normalizeEvents({ events: body.events }) }
      : linkTouched
      ? { ...(current?.payload && typeof current.payload === 'object' ? (current.payload as object) : {}), layout: nextExtras.layout, animation: nextExtras.animation, priorityMode: nextExtras.priorityMode, rules: nextExtras.rules, minAge: nextExtras.minAge }
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
      ...(body.priority !== undefined || body.priorityMode !== undefined
        ? { priority: blockPriority(type, body, nextExtras.priorityMode) }
        : {}),
      ...(body.scheduleOn !== undefined ? { scheduleOn: body.scheduleOn } : {}),
      ...(body.startsLocal !== undefined ? { startsAt } : {}),
      ...(body.endsLocal !== undefined ? { endsAt } : {}),
      ...(body.postId ? { postId: body.postId } : {}),
      ...(body.thumbnail !== undefined
        ? { thumbnail: canonicalizeStoredMedia((body.thumbnail || '').trim()) }
        : {}),
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

  private async readable(value: string, access: 'private' | 'public') {
    const raw = (value || '').trim();
    if (!raw) {
      return '';
    }
    const next = await deliverStoredMedia(raw, access);
    if (!next) {
      return raw.startsWith('http') || raw.startsWith('/') ? publicAsset(raw) : raw;
    }
    if (next === raw && !raw.startsWith('http') && !raw.startsWith('/uploads')) {
      return publicAsset(raw);
    }
    return next;
  }

  private async toEditor(record: LinkPageRecord) {
    const clicks = await this._repository.clickCounts(record.id);
    const byBlock = new Map(clicks.filter((row) => row.blockId).map((row) => [row.blockId, row._count._all]));
    const paid = isPaidPlan(record.organization.subscription);
    const open = linkFeatureOpen(record.organization.subscription);
    const customDomainAddon = hasCustomDomainAddon(record.organization);
    const design = normalizeDesign(record.design);
    const accounts = await this.accounts(record.organizationId, design);
    const hostname = record.customDomain || '';
    return {
      id: record.id,
      slug: record.slug,
      name: record.name.slice(0, 30),
      bio: record.bio,
      avatarPath: await this.readable(record.avatarPath, 'private'),
      theme: record.theme,
      buttonStyle: record.buttonStyle,
      font: record.font,
      backgroundMode: record.backgroundMode,
      backgroundColor: record.backgroundColor,
      backgroundImage: await this.readable(record.backgroundImage, 'private'),
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      isPublic: record.isPublic,
      sensitive: record.sensitive,
      hideBadge: record.hideBadge && open,
      gating: LINK_PLAN_GATING_ENABLED,
      design,
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
      accounts,
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
      blocks: await Promise.all(record.blocks.map(async (block) => {
        const images = block.type === 'IMAGE_CAROUSEL' ? normalizeImages(block.payload) : [];
        const post = block.post ? this.postCard(block.post, record.timezone) : null;
        return {
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
        thumbnail: await this.readable(block.thumbnail, 'private'),
        iconMode: block.iconMode,
        spotlight: block.spotlight,
        body: block.body,
        lock: { type: block.lockType, hasPassword: !!block.lockHash },
        faq: block.type === 'FAQ' ? normalizeFaq(block.payload) : [],
        images: await Promise.all(images.map(async (image) => ({
          ...image,
          path: await this.readable(image.path, 'private'),
        }))),
        form: block.type === 'CONTACT_FORM' ? normalizeForm(block) : null,
        details: block.type === 'CONTACT_DETAILS' ? normalizeDetails(block.payload) : null,
        discount: block.type === 'DISCOUNT' ? normalizeDiscount(block) : null,
        events: block.type === 'EVENTS' ? normalizeEvents(block.payload) : [],
        ...normalizeLinkExtras(block.type === 'LINK' ? block.payload : {}),
        post: post ? { ...post, image: await this.readable(post.image, 'private') } : null,
        };
      })),
    };
  }

  private async latestYoutube(raw: string) {
    const target = youtubeChannelTarget(raw);
    if (!target) {
      return null;
    }
    let feed = target.kind === 'feed' ? target.url : '';
    if (target.kind === 'page') {
      const html = await this.readPublicText(target.url);
      const channel = html ? youtubeChannelIdFromHtml(html) : '';
      if (!channel) {
        return null;
      }
      feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`;
    }
    const xml = await this.readPublicText(feed);
    const id = xml ? latestYoutubeVideoId(xml) : '';
    const embed = id ? youtubeWatchEmbed(id) : null;
    if (!embed || !id) {
      return null;
    }
    return { embed, url: `https://www.youtube.com/watch?v=${id}` };
  }

  private async readPublicText(url: string) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'user-agent': 'crea8.one' },
      });
      if (!response.ok) {
        return '';
      }
      return await response.text();
    } catch {
      return '';
    }
  }

  private async toPublic(record: LinkPageRecord, visitor = normalizeVisitor({})) {
    const open = linkFeatureOpen(record.organization.subscription);
    const design = normalizeDesign(record.design);
    const accounts = await this.accounts(record.organizationId, design);
    const visible = record.isPublic
      ? record.blocks.filter((block) => blockState(block) === 'live').filter((block) => {
          if (block.type === 'LINK' && linkIsHidden(block.payload, visitor)) {
            return false;
          }
          if (block.type !== 'FEATURED_POST') {
            return true;
          }
          return !!block.post && block.post.state === 'PUBLISHED' && !block.post.deletedAt;
        })
      : [];
    const capture = visible.some((block) => block.type === 'EMAIL_CAPTURE');
    const blocks = await Promise.all(visible.map(async (block) => {
      const view = presentPublicBlock(block, open, visitor, record.timezone);
      const latest = block.type === 'LATEST_YOUTUBE' ? await this.latestYoutube(block.url) : null;
      const post = block.post ? this.postCard(block.post, record.timezone, true) : null;
      return {
        ...view,
        ...(latest ? { embed: latest.embed, url: latest.url } : {}),
        thumbnail: await this.readable(view.thumbnail, 'public'),
        images: await Promise.all(view.images.map(async (image) => ({
          ...image,
          path: await this.readable(image.path, 'public'),
        }))),
        post: post ? { ...post, image: await this.readable(post.image, 'public') } : null,
      };
    }));
    const redirect = open
      ? visible.find((block) => block.type === 'LINK' && block.lockType === 'NONE' && normalizeLinkExtras(block.payload).priorityMode === 'redirect')
      : undefined;
    return {
      slug: record.slug,
      name: record.name.slice(0, 30),
      bio: record.bio,
      avatarPath: await this.readable(record.avatarPath, 'public'),
      theme: record.theme,
      buttonStyle: record.buttonStyle,
      font: record.font,
      backgroundMode: record.backgroundMode,
      backgroundColor: record.backgroundColor,
      backgroundImage: await this.readable(record.backgroundImage, 'public'),
      design,
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      isPublic: record.isPublic,
      sensitive: record.sensitive,
      showBadge: showBadge(record.hideBadge, open),
      socials: this.mergedSocials(record.socials, accounts),
      redirectUrl: redirect && !urlProblem(redirect.url) ? redirect.url : '',
      capture: capture
        ? {
            heading: record.captureHeading,
            button: record.captureButton || 'Subscribe',
            consent: record.captureConsent,
            askName: record.captureAskName,
          }
        : null,
      blocks,
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

  private async canonicalTikTok(raw: string) {
    const trimmed = raw.trim();
    let current = trimmed;
    try {
      for (let hop = 0; hop < 4; hop += 1) {
        const url = new URL(current);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (!['vm.tiktok.com', 'vt.tiktok.com', 'tiktok.com', 'm.tiktok.com'].includes(host)) {
          return trimmed;
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[1] === 'video' && /^\d{8,22}$/.test(parts[2] || '')) {
          return `https://www.tiktok.com${url.pathname}`;
        }
        const short = host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || (host === 'tiktok.com' && parts[0] === 't');
        if (!short) {
          return trimmed;
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(4000),
          headers: { 'user-agent': 'crea8.one' },
        });
        const location = response.headers.get('location');
        if (!location) {
          return trimmed;
        }
        const next = new URL(location, url);
        if (!['https:', 'http:'].includes(next.protocol)) {
          return trimmed;
        }
        current = next.toString();
      }
    } catch {
      return trimmed;
    }
    return trimmed;
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

  private mergedSocials(
    value: unknown,
    accounts: Array<{ id: string; network: string; url: string; shown: boolean }>
  ) {
    const manual = this.socials(value).filter((item) => !urlProblem(item.url));
    const connected = accounts.filter((item) => item.shown && !urlProblem(item.url));
    const seen = new Set<string>();
    const out: Array<{ network: string; url: string }> = [];
    for (const item of [...connected, ...manual]) {
      const key = `${item.network}|${item.url}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({ network: item.network, url: item.url });
      if (out.length === 12) {
        break;
      }
    }
    return out;
  }

  private async accounts(organizationId: string, design: { hiddenSocials: string[] }) {
    const hidden = new Set(design.hiddenSocials);
    const rows = await this._repository.connectedAccounts(organizationId);
    return rows.flatMap((row) => {
      const provider = this._integrations.getSocialIntegration(row.providerIdentifier);
      const profile = provider?.linkProfile?.({ profile: row.profile, internalId: row.internalId });
      if (!profile || urlProblem(profile.url)) {
        return [];
      }
      return [
        {
          id: row.id,
          network: profile.network,
          name: row.name,
          url: profile.url,
          picture: row.picture || '',
          shown: !hidden.has(row.id),
        },
      ];
    });
  }

  private detailInput(body: SaveLinkBlockDto) {
    return {
      email: body.detailEmail || '',
      phone: body.detailPhone || '',
      address: body.detailAddress || '',
      website: body.detailWebsite || '',
    };
  }

  private async quietOthers(pageId: string, exceptId: string, fields: { animation: boolean; focus: boolean }) {
    const blocks = await this._repository.otherLinks(pageId, exceptId);
    for (const block of blocks) {
      const extras = normalizeLinkExtras(block.payload);
      const payload = {
        ...(block.payload && typeof block.payload === 'object' ? (block.payload as object) : {}),
        layout: extras.layout,
        animation: fields.animation ? 'none' : extras.animation,
        priorityMode: fields.focus ? 'none' : extras.priorityMode,
        rules: extras.rules,
        minAge: extras.minAge,
      };
      const dirty = (fields.animation && extras.animation !== 'none') || (fields.focus && (extras.priorityMode !== 'none' || block.priority));
      if (!dirty) {
        continue;
      }
      await this._repository.updateBlock(block.id, {
        ...(fields.focus ? { priority: false } : {}),
        payload: payload as Prisma.InputJsonValue,
      });
    }
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
