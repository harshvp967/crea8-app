import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import {
  PublicLinkContactDto,
  PublicLinkSubscribeDto,
  PublicLinkTrackDto,
  PublicLinkUnlockDto,
} from '@gitroom/nestjs-libraries/dtos/link-in-bio/link.dto';

@ApiTags('Link-in-Bio public')
@Controller('/public/link')
export class LinkPublicController {
  constructor(private _linkService: LinkService) {}

  @Get('/confirm/:token')
  confirm(@Param('token') token: string) {
    return this._linkService.confirm(token);
  }

  @Get('/host/:hostname')
  byHost(@Param('hostname') hostname: string) {
    return this._linkService.publicByHost(hostname);
  }

  @Get('/:slug')
  bySlug(@Param('slug') slug: string) {
    return this._linkService.publicBySlug(slug);
  }

  @Post('/view')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { ttl: 3600000, limit: 240 } })
  view(
    @Body() body: PublicLinkTrackDto,
    @Headers('x-link-country') country = '',
    @Headers('x-link-ua') userAgent = ''
  ) {
    return this._linkService.track('VIEW', body, country, userAgent);
  }

  @Post('/click')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { ttl: 3600000, limit: 240 } })
  click(
    @Body() body: PublicLinkTrackDto,
    @Headers('x-link-country') country = '',
    @Headers('x-link-ua') userAgent = ''
  ) {
    return this._linkService.track('CLICK', body, country, userAgent);
  }

  @Post('/subscribe')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  subscribe(@Body() body: PublicLinkSubscribeDto, @Headers('x-link-country') country = '') {
    return this._linkService.subscribe(body, country);
  }

  @Post('/unlock')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { ttl: 3600000, limit: 20 } })
  unlock(@Body() body: PublicLinkUnlockDto, @Headers('x-link-country') country = '') {
    return this._linkService.unlock(body, country);
  }

  @Post('/contact')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  contact(@Body() body: PublicLinkContactDto, @Headers('x-link-country') country = '') {
    return this._linkService.contact(body, country);
  }
}
