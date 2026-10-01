import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import {
  CreateStalkerKeywordDto,
  StalkerDraftDto,
  StalkerMentionQueryDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';

@ApiTags('Stalker')
@Controller('/stalker')
export class StalkerController {
  constructor(private _stalkerService: StalkerService) {}

  @Get('/status')
  status() {
    return this._stalkerService.status();
  }

  @Get('/mentions')
  mentions(
    @GetOrgFromRequest() org: Organization,
    @Query() query: StalkerMentionQueryDto
  ) {
    return this._stalkerService.mentions(org.id, query);
  }

  @Get('/keywords')
  keywords(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.keywords(org.id);
  }

  @Post('/keywords')
  createKeyword(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerKeywordDto
  ) {
    return this._stalkerService.createKeyword(org.id, body);
  }

  @Delete('/keywords/:id')
  deleteKeyword(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.deleteKeyword(org.id, id);
  }

  @Get('/themes')
  themes(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.themes(org.id);
  }

  @Post('/draft')
  draft(@GetOrgFromRequest() org: Organization, @Body() body: StalkerDraftDto) {
    return this._stalkerService.draft(org.id, body);
  }

  @Post('/poll')
  poll(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.pollOrganization(org.id);
  }
}
