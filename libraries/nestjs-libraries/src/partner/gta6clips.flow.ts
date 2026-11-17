import { randomUUID } from 'crypto';
import {
  Gta6clipsPlanClaim,
  verifyGta6clipsToken,
} from '@gitroom/nestjs-libraries/partner/gta6clips.token';
import { isPartnerVideoUrl } from '@gitroom/nestjs-libraries/partner/gta6clips.host';
import { loginDecision } from '@gitroom/nestjs-libraries/partner/gta6clips.plan';
import { GTA6CLIPS_PLAN_ID } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export const CAPTION_MAX = 2200;

export type Arrive =
  | { status: 'disabled' | 'open' | 'replay' | 'refused'; grant: false; caption: string; video: string | null }
  | { status: 'session'; grant: true; created: boolean; userId: string; organizationId: string; caption: string; video: string | null }
  | { status: 'collision'; grant: false; pendingId: string; email: string; caption: string; video: string | null };

export type PartnerStore = {
  jtiUsed(jti: string): Promise<boolean>;
  saveJti(row: { jti: string; sub: string; email: string; organizationId: string | null }): Promise<'saved' | 'replay'>;
  attachJti(jti: string, organizationId: string): Promise<void>;
  findBySub(sub: string): Promise<{ userId: string; email: string; organizationId: string } | null>;
  findByEmail(email: string): Promise<{
    userId: string;
    email: string;
    organizationId: string | null;
    linkedSub: string | null;
  } | null>;
  createAccount(input: { email: string; sub: string }): Promise<{ userId: string; organizationId: string }>;
  grant(input: {
    organizationId: string;
    userId: string;
    sub: string;
    email: string;
    gta6clipsPlan: Gta6clipsPlanClaim;
    recordedAt: Date;
  }): Promise<'granted' | 'idempotent' | 'rejected'>;
  savePending(row: {
    id: string;
    jti: string;
    sub: string;
    email: string;
    video: string | null;
    caption: string;
    expiresAt: Date;
    gta6clipsPlan: Gta6clipsPlanClaim;
  }): Promise<void>;
  readPending(
    id: string,
    now: Date
  ): Promise<{
    id: string;
    jti: string;
    sub: string;
    email: string;
    video: string | null;
    caption: string;
    gta6clipsPlan: Gta6clipsPlanClaim;
  } | null>;
};

function clip(caption: string | undefined) {
  return (caption || '').slice(0, CAPTION_MAX);
}

function videoOf(value: string | undefined) {
  const video = (value || '').trim();
  return video && isPartnerVideoUrl(video) ? video : null;
}

export async function arrivePartnerLink(
  input: { token?: string; secret?: string; video?: string; caption?: string; nowSec?: number },
  store: PartnerStore
): Promise<Arrive> {
  const caption = clip(input.caption);
  const video = videoOf(input.video);
  const secret = (input.secret || '').trim();
  if (!secret) {
    return { status: 'disabled', grant: false, caption, video };
  }
  const used = new Set<string>();
  const checked = verifyGta6clipsToken(input.token, secret, used, input.nowSec);
  if (!checked.ok) {
    return { status: 'open', grant: false, caption, video };
  }
  if (await store.jtiUsed(checked.claims.jti)) {
    return { status: 'replay', grant: false, caption, video };
  }
  const gta6clipsPlan = checked.claims.gta6clips_plan;
  const recordedAt = new Date((input.nowSec ?? Math.floor(Date.now() / 1000)) * 1000);
  const saved = await store.saveJti({
    jti: checked.claims.jti,
    sub: checked.claims.sub,
    email: checked.claims.email,
    organizationId: null,
  });
  if (saved === 'replay') {
    return { status: 'replay', grant: false, caption, video };
  }

  const bySub = await store.findBySub(checked.claims.sub);
  const byEmail = bySub ? null : await store.findByEmail(checked.claims.email);
  const decision = loginDecision({
    sub: checked.claims.sub,
    email: checked.claims.email,
    bySub,
    byEmail,
  });
  if (decision === 'refuse') {
    return { status: 'refused', grant: false, caption, video };
  }
  if (decision === 'collision') {
    const pendingId = randomUUID();
    await store.savePending({
      id: pendingId,
      jti: checked.claims.jti,
      sub: checked.claims.sub,
      email: checked.claims.email,
      video,
      caption,
      expiresAt: new Date((checked.claims.exp || 0) * 1000),
      gta6clipsPlan,
    });
    return { status: 'collision', grant: false, pendingId, email: checked.claims.email, caption, video };
  }

  const account = decision === 'create'
    ? await store.createAccount({ email: checked.claims.email, sub: checked.claims.sub })
    : {
        userId: (bySub || byEmail)!.userId,
        organizationId: (bySub?.organizationId || byEmail?.organizationId) as string,
      };
  const grant = await store.grant({
    organizationId: account.organizationId,
    userId: account.userId,
    sub: checked.claims.sub,
    email: checked.claims.email,
    gta6clipsPlan,
    recordedAt,
  });
  if (grant === 'rejected') {
    return { status: 'refused', grant: false, caption, video };
  }
  await store.attachJti(checked.claims.jti, account.organizationId);
  return {
    status: 'session',
    grant: true,
    created: decision === 'create',
    userId: account.userId,
    organizationId: account.organizationId,
    caption,
    video,
  };
}

export async function completePartnerLink(
  input: { pendingId: string; userId: string; email: string; organizationId: string; now?: Date },
  store: PartnerStore
): Promise<Arrive> {
  const pending = await store.readPending(input.pendingId, input.now || new Date());
  if (!pending) {
    return { status: 'open', grant: false, caption: '', video: null };
  }
  if (pending.email.toLowerCase() !== input.email.toLowerCase()) {
    return { status: 'refused', grant: false, caption: pending.caption, video: pending.video };
  }
  const existingOrg = await store.findBySub(pending.sub);
  const organizationId = existingOrg?.organizationId || input.organizationId;
  const grant = await store.grant({
    organizationId,
    userId: existingOrg?.userId || input.userId,
    sub: pending.sub,
    email: pending.email,
    gta6clipsPlan: pending.gta6clipsPlan,
    recordedAt: input.now || new Date(),
  });
  if (grant === 'rejected') {
    return { status: 'refused', grant: false, caption: pending.caption, video: pending.video };
  }
  await store.attachJti(pending.jti, organizationId);
  return {
    status: 'session',
    grant: true,
    created: false,
    userId: existingOrg?.userId || input.userId,
    organizationId,
    caption: pending.caption,
    video: pending.video,
  };
}

export const partnerPlanId = GTA6CLIPS_PLAN_ID;
