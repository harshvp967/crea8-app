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
import { Organization, StalkerMentionStatus } from '@prisma/client';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import {
  CreateStalkerKeywordDto,
  CreateStalkerProjectDto,
  StalkerDraftDto,
  StalkerMentionQueryDto,
  StalkerMentionStatusDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';

@ApiTags('Stalker')
@Controller('/stalker')
export class StalkerController {
  constructor(private _stalkerService: StalkerService) {}

  @Get('/status')
  status(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.status(org.id);
  }

  @Get('/projects')
  projects(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.projects(org.id);
  }

  @Post('/projects')
  createProject(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerProjectDto
  ) {
    return this._stalkerService.createProject(org.id, body);
  }

  @Get('/mentions')
  mentions(
    @GetOrgFromRequest() org: Organization,
    @Query() query: StalkerMentionQueryDto
  ) {
    return this._stalkerService.mentions(org.id, query);
  }

  @Post('/mentions/:id/status')
  setMentionStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: StalkerMentionStatusDto
  ) {
    return this._stalkerService.setMentionStatus(
      org.id,
      id,
      body.status as StalkerMentionStatus
    );
  }

  @Get('/keywords')
  keywords(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.keywords(org.id, projectId);
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

  @Get('/analytics')
  analytics(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.analytics(org.id, projectId);
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
