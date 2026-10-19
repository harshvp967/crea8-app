import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { BrandVoiceService } from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.service';
import {
  BrandVoiceSamplesDto,
  BrandVoiceToggleDto,
} from '@gitroom/nestjs-libraries/dtos/brand-voice/brand.voice.dto';

@ApiTags('Brand voice')
@Controller('/brand-voice')
export class BrandVoiceController {
  constructor(private _brandVoiceService: BrandVoiceService) {}

  @Get('/')
  get(@GetOrgFromRequest() org: Organization) {
    if (!org?.id) {
      throw new HttpForbiddenException();
    }
    return this._brandVoiceService.get(org);
  }

  @Post('/')
  extract(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandVoiceSamplesDto
  ) {
    if (!org?.id) {
      throw new HttpForbiddenException();
    }
    return this._brandVoiceService.extract(org, body);
  }

  @Put('/')
  setEnabled(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandVoiceToggleDto
  ) {
    if (!org?.id) {
      throw new HttpForbiddenException();
    }
    return this._brandVoiceService.setEnabled(org, body.enabled);
  }
}
