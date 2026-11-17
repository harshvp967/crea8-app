import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Gta6clipsExchangeDto, Gta6clipsLinkDto } from '@gitroom/nestjs-libraries/dtos/partner/gta6clips.exchange.dto';
import { Gta6clipsService } from '@gitroom/nestjs-libraries/partner/gta6clips.service';
import { sessionCookieOptions } from '@gitroom/helpers/auth/session.cookies';
import {
  AuthRateLimitGuard,
  PartnerExchangeRateLimitGuard,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

@ApiTags('Partner')
@Controller('/partner/gta6clips')
export class Gta6clipsController {
  constructor(
    private _partner: Gta6clipsService,
    private _users: UsersService,
    private _organizations: OrganizationService
  ) {}

  @UseGuards(PartnerExchangeRateLimitGuard)
  @Post('/exchange')
  async exchange(
    @Body() body: Gta6clipsExchangeDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this._partner.exchange(body);
    if (result.status === 'session' && 'auth' in result && result.auth) {
      response.cookie('auth', result.auth, sessionCookieOptions());
      response.cookie('showorg', result.organizationId, sessionCookieOptions());
    }
    const { auth, ...rest } = result as { auth?: string };
    return rest;
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('/link')
  async link(
    @Body() body: Gta6clipsLinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.session(req);
    if (!session) {
      return { status: 'refused', grant: false };
    }
    const result = await this._partner.link({
      pendingId: body.pendingId,
      userId: session.userId,
      email: session.email,
      organizationId: session.organizationId,
    });
    if (result.status === 'session' && 'auth' in result && result.auth) {
      response.cookie('auth', result.auth, sessionCookieOptions());
      response.cookie('showorg', result.organizationId, sessionCookieOptions());
    }
    const { auth, ...rest } = result as { auth?: string };
    return rest;
  }

  private async session(req: Request) {
    const headerAuth = req.headers.auth;
    const auth =
      (Array.isArray(headerAuth) ? headerAuth[0] : headerAuth) || req.cookies?.auth;
    if (!auth || typeof auth !== 'string') {
      return null;
    }
    try {
      const payload = AuthService.verifyJWT(auth) as { id?: string } | null;
      if (!payload?.id) {
        return null;
      }
      const user = await this._users.getUserById(payload.id);
      if (!user?.activated || !user.email) {
        return null;
      }
      const headerOrg = req.headers.showorg;
      const orgHeader =
        (Array.isArray(headerOrg) ? headerOrg[0] : headerOrg) || req.cookies?.showorg;
      const organization = (await this._organizations.getOrgsByUserId(user.id)).filter(
        (item) => !item.users[0].disabled
      );
      const current = organization.find((item) => item.id === orgHeader) || organization[0];
      if (!current) {
        return null;
      }
      return { userId: user.id, email: user.email, organizationId: current.id };
    } catch {
      return null;
    }
  }
}
