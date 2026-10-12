import { randomBytes } from 'crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { CloudflareCustomHostnameService } from '@gitroom/nestjs-libraries/services/cloudflare.custom-hostname.service';
import {
  LinkRepository,
  LinkPageRecord,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.repository';
import {
  LINK_BLOCK_CAP,
  blockState,
  buildAnalytics,
  cleanCountry,
  countryName,
  domainProblem,
  domainRecords,
  emailProblem,
  fillDays,
  firstImage,
  hasCustomDomainAddon,
  isPaidPlan,
  isValidTimeZone,
  leadsToCsv,
  pageUrl,
  plainText,
  platformLabel,
  publicAsset,
  publicOrigin,
  rangeWindow,
  sanitizeReferrer,
  shortDate,
  showBadge,
  slugProblem,
  sourceLabel,
  suggestSlug,
  urlProblem,
  utcDay,
  zonedLocalToUtc,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  PublicLinkSubscribeDto,
  PublicLinkTrackDto,
  SaveLinkBlockDto,
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
    const type = id ? (await this.requireBlock(record.id, id)).type : body.type;
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
    const data = await this.blockData(org.id, record.timezone, type, body);
    const block = id
      ? await this._repository.updateBlock(id, data)
      : await this._repository.createBlock({
          pageId: record.id,
          type: type as 'LINK',
          position: record.blocks.length,
          ...data,
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

  async analytics(org: PlanOrg, range: string) {
    const record = await this.ensure(org);
    const window = rangeWindow(range);
    const [views, clicks, subscribers, previousViews, previousClicks, previousSubscribers, series, countries, sources, linkClicks] =
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
      ]);
    const titles = new Map(record.blocks.map((block) => [block.id, block.title || 'Link']));
    return {
      range: range === '7d' || range === '90d' || range === '12m' ? range : '30d',
      ...buildAnalytics({
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
            title: titles.get(row.blockId || '') || 'Deleted link',
            clicks: row._count._all,
          })),
        countries: countries
          .filter((row) => row.country)
          .map((row) => ({ code: row.country, views: row._count._all })),
        sources: sources.map((row) => ({ source: row.source, views: row._count._all })),
      }),
    };
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
      }))
    );
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

  async track(kind: 'VIEW' | 'CLICK', body: PublicLinkTrackDto, countryHeader: string) {
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
    await this._repository.insertEvent({
      pageId: record.id,
      blockId: kind === 'CLICK' ? body.blockId : null,
      type: kind,
      country: cleanCountry(countryHeader),
      source: sourceLabel(body),
      referrer: sanitizeReferrer(body.referrer || ''),
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
    }
    return { slug: lead.page.slug, name: lead.page.name };
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

  private async blockData(orgId: string, timeZone: string, type: string, body: SaveLinkBlockDto) {
    const title = (body.title || '').trim();
    const url = (body.url || '').trim();
    if (type === 'LINK') {
      if (body.title !== undefined && !title) {
        throw new BadRequestException('Add a title');
      }
      if (!body.title && !url) {
        throw new BadRequestException('Add a title');
      }
      if (url && urlProblem(url)) {
        throw new BadRequestException(urlProblem(url));
      }
      if (body.url !== undefined && !url) {
        throw new BadRequestException('Add a URL');
      }
    }
    if (type === 'HEADING' && body.title !== undefined && !title) {
      throw new BadRequestException('Add a heading');
    }
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
      blocks: visible.map((block) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        url: block.url,
        priority: block.priority,
        post: block.post ? this.postCard(block.post, record.timezone, true) : null,
      })),
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
