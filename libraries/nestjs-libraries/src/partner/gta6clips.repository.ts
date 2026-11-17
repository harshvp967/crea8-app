import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { GTA6CLIPS_PLAN_ID } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { PartnerStore } from '@gitroom/nestjs-libraries/partner/gta6clips.flow';
import { grantDecision } from '@gitroom/nestjs-libraries/partner/gta6clips.plan';

const PARTNER = 'gta6clips';

@Injectable()
export class Gta6clipsRepository implements PartnerStore {
  constructor(private _prisma: PrismaService) {}

  jtiUsed(jti: string) {
    return this._prisma.partnerLinkUse
      .findUnique({ where: { jti }, select: { jti: true } })
      .then((row) => !!row);
  }

  async saveJti(row: { jti: string; sub: string; email: string; organizationId: string | null }) {
    try {
      await this._prisma.partnerLinkUse.create({
        data: {
          jti: row.jti,
          partner: PARTNER,
          sub: row.sub,
          email: row.email,
          organizationId: row.organizationId,
        },
      });
      return 'saved' as const;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return 'replay' as const;
      }
      throw err;
    }
  }

  attachJti(jti: string, organizationId: string) {
    return this._prisma.partnerLinkUse
      .update({ where: { jti }, data: { organizationId } })
      .then(() => undefined);
  }

  findBySub(sub: string) {
    return this._prisma.partnerAccount.findFirst({
      where: { partner: PARTNER, sub },
      select: { userId: true, email: true, organizationId: true },
    });
  }

  async findByEmail(email: string) {
    const user = await this._prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, providerName: 'LOCAL', deletedAt: null },
      select: {
        id: true,
        email: true,
        organizations: {
          where: { disabled: false },
          select: { organizationId: true },
          take: 1,
        },
        partnerAccounts: { select: { sub: true, organizationId: true }, take: 1 },
      },
    });
    if (!user) {
      return null;
    }
    const link = user.partnerAccounts[0];
    return {
      userId: user.id,
      email: user.email,
      organizationId: link?.organizationId || user.organizations[0]?.organizationId || null,
      linkedSub: link?.sub || null,
    };
  }

  async createAccount(input: { email: string; sub: string }) {
    const name = input.email.split('@')[0].slice(0, 40) || 'workspace';
    return this._prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          password: '',
          providerName: 'LOCAL',
          providerId: `gta6clips:${input.sub}`,
          activated: true,
          timezone: 0,
        },
      });
      const organization = await tx.organization.create({
        data: {
          name,
          apiKey: AuthService.fixedEncryption(makeSecureId(20)),
          allowTrial: false,
          isTrailing: false,
          users: { create: { role: 'SUPERADMIN', userId: user.id } },
        },
      });
      return { userId: user.id, organizationId: organization.id };
    });
  }

  async grant(input: { organizationId: string; userId: string; sub: string; email: string }) {
    const [org, sub] = await Promise.all([
      this._prisma.partnerAccount.findUnique({
        where: { organizationId: input.organizationId },
        select: { sub: true, plan: true, partner: true },
      }),
      this.findBySub(input.sub),
    ]);
    const decision = grantDecision(
      input.organizationId,
      input.sub,
      org,
      sub ? { organizationId: sub.organizationId } : null
    );
    if (decision === 'reject') {
      return 'rejected' as const;
    }
    if (decision === 'grant') {
      await this._prisma.partnerAccount.create({
        data: {
          partner: PARTNER,
          sub: input.sub,
          email: input.email,
          plan: GTA6CLIPS_PLAN_ID,
          userId: input.userId,
          organizationId: input.organizationId,
        },
      });
      return 'granted' as const;
    }
    if (org?.partner === PARTNER && org.plan !== GTA6CLIPS_PLAN_ID) {
      await this._prisma.partnerAccount.update({
        where: { organizationId: input.organizationId },
        data: { plan: GTA6CLIPS_PLAN_ID },
      });
    }
    return 'idempotent' as const;
  }

  savePending(row: {
    id: string;
    jti: string;
    sub: string;
    email: string;
    video: string | null;
    caption: string;
    expiresAt: Date;
  }) {
    return this._prisma.partnerLinkPending
      .create({
        data: {
          id: row.id,
          jti: row.jti,
          sub: row.sub,
          email: row.email,
          video: row.video,
          caption: row.caption,
          expiresAt: row.expiresAt,
        },
      })
      .then(() => undefined);
  }

  async readPending(id: string, now: Date) {
    const row = await this._prisma.partnerLinkPending.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return row;
  }

  planForOrg(organizationId: string) {
    return this._prisma.partnerAccount
      .findUnique({ where: { organizationId }, select: { plan: true, sub: true } })
      .then((row) => row);
  }

  countChannels(organizationId: string) {
    return this._prisma.integration.count({
      where: { organizationId, deletedAt: null, disabled: false, refreshNeeded: false },
    });
  }
}
