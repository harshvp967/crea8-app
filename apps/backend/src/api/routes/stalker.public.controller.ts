import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

@ApiTags('Stalker public')
@Controller('/public/stalker')
export class StalkerPublicController {
  constructor(private _stalkerService: StalkerService) {}

  @Get('/:token')
  board(@Param('token') token: string) {
    return this._stalkerService.publicBoard(token);
  }
}
