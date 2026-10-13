import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, StalkerMentionStatus } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import {
  CreateStalkerAlertRuleDto,
  CreateStalkerKeywordDto,
  StalkerMentionQueryDto,
  StalkerMentionStatusDto,
  UpdateStalkerKeywordDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import {
  ReorderLinkBlocksDto,
  SaveLinkBlockDto,
  UpdateLinkPageDto,
  UpdateLinkSlugDto,
} from '@gitroom/nestjs-libraries/dtos/link-in-bio/link.dto';

@ApiTags('Public API')
@Controller('/public/v1')
export class PublicAgentController {
  constructor(
    private _stalkerService: StalkerService,
    private _linkService: LinkService
  ) {}

  @Get('/stalker/projects')
  stalkerProjects(@GetOrgFromRequest() org: Organization) {
    return this._stalkerService.projects(org.id);
  }

  @Get('/stalker/mentions')
  stalkerMentions(
    @GetOrgFromRequest() org: Organization,
    @Query() query: StalkerMentionQueryDto
  ) {
    return this._stalkerService.mentions(org.id, query);
  }

  @Post('/stalker/mentions/:id/status')
  stalkerMentionStatus(
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

  @Get('/stalker/keywords')
  stalkerKeywords(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.keywords(org.id, projectId);
  }

  @Post('/stalker/keywords')
  stalkerCreateKeyword(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerKeywordDto
  ) {
    return this._stalkerService.createKeyword(org.id, body);
  }

  @Put('/stalker/keywords/:id')
  stalkerUpdateKeyword(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateStalkerKeywordDto
  ) {
    return this._stalkerService.updateKeyword(org.id, id, body);
  }

  @Delete('/stalker/keywords/:id')
  stalkerDeleteKeyword(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._stalkerService.deleteKeyword(org.id, id);
  }

  @Get('/stalker/alerts')
  stalkerAlerts(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string
  ) {
    const parsed = take ? Number(take) : undefined;
    return this._stalkerService.alerts(
      org.id,
      projectId,
      cursor,
      Number.isFinite(parsed) ? parsed : undefined
    );
  }

  @Post('/stalker/alerts/:id/read')
  stalkerAlertRead(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._stalkerService.markAlertRead(org.id, id);
  }

  @Get('/stalker/rules')
  stalkerRules(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.alertRules(org.id, projectId);
  }

  @Post('/stalker/rules')
  stalkerCreateRule(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerAlertRuleDto
  ) {
    return this._stalkerService.createAlertRule(
      org.id,
      body.projectId,
      body.name,
      body.filters as unknown as Record<string, unknown>
    );
  }

  @Delete('/stalker/rules/:id')
  stalkerDeleteRule(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._stalkerService.deleteAlertRule(org.id, id);
  }

  @Get('/link')
  linkPage(@GetOrgFromRequest() org: Organization) {
    return this._linkService.page(org);
  }

  @Put('/link')
  linkUpdate(@GetOrgFromRequest() org: Organization, @Body() body: UpdateLinkPageDto) {
    return this._linkService.update(org, body);
  }

  @Put('/link/slug')
  linkSlug(@GetOrgFromRequest() org: Organization, @Body() body: UpdateLinkSlugDto) {
    return this._linkService.setSlug(org, body.slug);
  }

  @Put('/link/blocks/reorder')
  linkReorder(@GetOrgFromRequest() org: Organization, @Body() body: ReorderLinkBlocksDto) {
    return this._linkService.reorder(org, body.ids);
  }

  @Post('/link/blocks')
  linkCreateBlock(@GetOrgFromRequest() org: Organization, @Body() body: SaveLinkBlockDto) {
    return this._linkService.saveBlock(org, null, body);
  }

  @Put('/link/blocks/:id')
  linkUpdateBlock(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SaveLinkBlockDto
  ) {
    return this._linkService.saveBlock(org, id, body);
  }

  @Delete('/link/blocks/:id')
  linkDeleteBlock(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._linkService.deleteBlock(org, id);
  }

  @Get('/link/analytics')
  linkAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Query('range') range = '30d',
    @Query('from') from = '',
    @Query('to') to = ''
  ) {
    return this._linkService.analytics(org, range, from, to);
  }

  @Get('/link/leads')
  linkLeads(
    @GetOrgFromRequest() org: Organization,
    @Query('status') status = '',
    @Query('q') query = ''
  ) {
    return this._linkService.leads(org, status, query);
  }
}
