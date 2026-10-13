import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import {
  LINK_PUBLIC_LIMITS,
  ThrottlerRealIpGuard,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';

// No auth. The list is the public slugs only; private pages never reach this handler's query.
@ApiTags('Link-in-Bio public')
@Controller(['/public', '/api/public'])
export class PublicLinksController {
  constructor(private _linkService: LinkService) {}

  @Get('/links')
  @Header('Cache-Control', 'public, max-age=300')
  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: LINK_PUBLIC_LIMITS.list })
  links() {
    return this._linkService.publicSlugs();
  }
}
