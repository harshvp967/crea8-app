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
  UpdateStalkerKeywordDto,
  CreateStalkerViewDto,
  CreateStalkerGroupDto,
  CreateStalkerAlertRuleDto,
  SaveStalkerCategoriesDto,
  StalkerDraftDto,
  StalkerMentionQueryDto,
  StalkerMentionStatusDto,
  StalkerReplyDto,
  StalkerSaveMentionDto,
  UpdateStalkerProjectDto,
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

  @Post('/projects/:id/scan')
  scanProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.requestScan(org.id, id, 'manual');
  }

  @Get('/projects/:id/scan')
  latestScan(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.latestScan(org.id, id);
  }

  @Post('/projects/:id')
  updateProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateStalkerProjectDto
  ) {
    return this._stalkerService.updateProject(org.id, id, body);
  }

  @Get('/mentions')
  mentions(
    @GetOrgFromRequest() org: Organization,
    @Query() query: StalkerMentionQueryDto
  ) {
    return this._stalkerService.mentions(org.id, query);
  }

  @Post('/mentions/:id/reply')
  reply(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: StalkerReplyDto
  ) {
    return this._stalkerService.reply(org.id, id, body);
  }

  @Post('/mentions/:id/save')
  saveMention(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: StalkerSaveMentionDto
  ) {
    return this._stalkerService.saveMention(org.id, id, body);
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

  @Post('/keywords/:id')
  updateKeyword(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateStalkerKeywordDto
  ) {
    return this._stalkerService.updateKeyword(org.id, id, body);
  }

  @Delete('/keywords/:id')
  deleteKeyword(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.deleteKeyword(org.id, id);
  }

  @Get('/alerts')
  alerts(
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

  @Post('/alerts/:id/read')
  markAlertRead(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.markAlertRead(org.id, id);
  }

  @Post('/alerts/retry')
  retryAlerts(
    @GetOrgFromRequest() org: Organization,
    @Body('projectId') projectId: string
  ) {
    return this._stalkerService.retryAlerts(org.id, projectId);
  }

  @Post('/keywords/:id/backfill')
  backfillKeyword(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.requestBackfill(org.id, id);
  }

  @Get('/export')
  exportMentions(
    @GetOrgFromRequest() org: Organization,
    @Query() query: StalkerMentionQueryDto
  ) {
    return this._stalkerService.exportMentions(org.id, query);
  }

  @Get('/analytics')
  analytics(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string,
    @Query('date') date?: string,
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return this._stalkerService.analytics(org.id, projectId, date, {
      start,
      end,
    });
  }

  @Get('/groups')
  groups(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.groups(org.id, projectId);
  }

  @Post('/groups')
  createGroup(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerGroupDto
  ) {
    return this._stalkerService.createGroup(org.id, body.projectId, body.name);
  }

  @Delete('/groups/:id')
  deleteGroup(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.deleteGroup(org.id, projectId, id);
  }

  @Get('/authors')
  authors(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.authors(org.id, projectId);
  }

  @Post('/rules')
  createRule(
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

  @Delete('/rules/:id')
  deleteRule(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.deleteAlertRule(org.id, id);
  }

  @Get('/rules')
  rules(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.alertRules(org.id, projectId);
  }

  @Post('/projects/:id/categories')
  saveCategories(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SaveStalkerCategoriesDto
  ) {
    return this._stalkerService.saveCategories(org.id, id, body.categories);
  }

  @Delete('/projects/:id')
  deleteProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.deleteProject(org.id, id);
  }

  @Get('/views')
  views(
    @GetOrgFromRequest() org: Organization,
    @Query('projectId') projectId: string
  ) {
    return this._stalkerService.views(org.id, projectId);
  }

  @Post('/views')
  createView(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateStalkerViewDto
  ) {
    return this._stalkerService.createView(org.id, body);
  }

  @Delete('/views/:id')
  deleteView(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._stalkerService.deleteView(org.id, id);
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
    return this._stalkerService.requestOrganizationScans(org.id, 'manual');
  }
}
