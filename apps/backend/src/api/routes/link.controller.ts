import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import {
  ConnectLinkDomainDto,
  ReorderLinkBlocksDto,
  SaveLinkBlockDto,
  UpdateLinkIntegrationsDto,
  UpdateLinkPageDto,
  UpdateLinkSlugDto,
} from '@gitroom/nestjs-libraries/dtos/link-in-bio/link.dto';

@ApiTags('Link-in-Bio')
@Controller('/link-in-bio')
export class LinkController {
  constructor(private _linkService: LinkService) {}

  @Get('/')
  page(@GetOrgFromRequest() org: Organization, @Query('timezone') timezone?: string) {
    return this._linkService.page(org, timezone);
  }

  @Put('/')
  update(@GetOrgFromRequest() org: Organization, @Body() body: UpdateLinkPageDto) {
    return this._linkService.update(org, body);
  }

  @Get('/slug')
  checkSlug(@GetOrgFromRequest() org: Organization, @Query('slug') slug = '') {
    return this._linkService.checkSlug(org, slug);
  }

  @Put('/slug')
  setSlug(@GetOrgFromRequest() org: Organization, @Body() body: UpdateLinkSlugDto) {
    return this._linkService.setSlug(org, body.slug);
  }

  @Get('/posts')
  posts(@GetOrgFromRequest() org: Organization) {
    return this._linkService.posts(org);
  }

  @Post('/blocks')
  createBlock(@GetOrgFromRequest() org: Organization, @Body() body: SaveLinkBlockDto) {
    return this._linkService.saveBlock(org, null, body);
  }

  @Put('/blocks/reorder')
  reorder(@GetOrgFromRequest() org: Organization, @Body() body: ReorderLinkBlocksDto) {
    return this._linkService.reorder(org, body.ids);
  }

  @Put('/blocks/:id')
  updateBlock(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SaveLinkBlockDto
  ) {
    return this._linkService.saveBlock(org, id, body);
  }

  @Delete('/blocks/:id')
  deleteBlock(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._linkService.deleteBlock(org, id);
  }

  @Get('/analytics.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="crea8-analytics.csv"')
  async exportAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Query('range') range = '30d',
    @Query('from') from = '',
    @Query('to') to = ''
  ) {
    const csv = await this._linkService.exportAnalytics(org, range, from, to);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('/analytics')
  analytics(
    @GetOrgFromRequest() org: Organization,
    @Query('range') range = '30d',
    @Query('from') from = '',
    @Query('to') to = ''
  ) {
    return this._linkService.analytics(org, range, from, to);
  }

  @Put('/integrations')
  integrations(@GetOrgFromRequest() org: Organization, @Body() body: UpdateLinkIntegrationsDto) {
    return this._linkService.integrations(org, body);
  }

  @Get('/leads.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="crea8-leads.csv"')
  async exportLeads(
    @GetOrgFromRequest() org: Organization,
    @Query('status') status = '',
    @Query('q') query = ''
  ) {
    const csv = await this._linkService.exportLeads(org, status, query);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('/leads')
  leads(
    @GetOrgFromRequest() org: Organization,
    @Query('status') status = '',
    @Query('q') query = ''
  ) {
    return this._linkService.leads(org, status, query);
  }

  @Post('/domain')
  connect(@GetOrgFromRequest() org: Organization, @Body() body: ConnectLinkDomainDto) {
    return this._linkService.connectDomain(org, body.domain);
  }

  @Post('/domain/check')
  check(@GetOrgFromRequest() org: Organization) {
    return this._linkService.checkDomain(org);
  }

  @Delete('/domain')
  remove(@GetOrgFromRequest() org: Organization) {
    return this._linkService.removeDomain(org);
  }

  @Get('/qr.png')
  @Header('Content-Type', 'image/png')
  @Header('Content-Disposition', 'attachment; filename="crea8-qr.png"')
  async qrPng(@GetOrgFromRequest() org: Organization) {
    return new StreamableFile(await this._linkService.qr(org, 'png'));
  }

  @Get('/qr.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Content-Disposition', 'attachment; filename="crea8-qr.svg"')
  async qrSvg(@GetOrgFromRequest() org: Organization) {
    return new StreamableFile(await this._linkService.qr(org, 'svg'));
  }
}
