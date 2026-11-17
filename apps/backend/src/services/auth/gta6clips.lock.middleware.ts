import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Gta6clipsRepository } from '@gitroom/nestjs-libraries/partner/gta6clips.repository';
import {
  CREA8_PRICING_URL,
  GTA6CLIPS_PLAN_ID,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { partnerRouteAllowed } from '@gitroom/nestjs-libraries/partner/gta6clips.plan';

@Injectable()
export class Gta6clipsLockMiddleware implements NestMiddleware {
  constructor(private _partner: Gta6clipsRepository) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const orgId = (req as Request & { org?: { id?: string } }).org?.id;
    if (!orgId) {
      next();
      return;
    }
    const plan = await this._partner.planForOrg(orgId);
    if (!plan || plan.plan !== GTA6CLIPS_PLAN_ID) {
      next();
      return;
    }
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (!partnerRouteAllowed(req.method, path)) {
      throw new HttpException({ locked: true, pricing: CREA8_PRICING_URL }, 402);
    }
    next();
  }
}
