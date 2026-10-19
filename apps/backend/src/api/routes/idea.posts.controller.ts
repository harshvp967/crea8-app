import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { IdeaPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/idea.posts.dto';
import { IdeaPostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts.service';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

@ApiTags('Idea posts')
@Controller('/idea-posts')
export class IdeaPostsController {
  constructor(private _ideaPostsService: IdeaPostsService) {}

  @Get('/')
  usage(@GetOrgFromRequest() org: Organization) {
    if (!org?.id) {
      throw new HttpForbiddenException();
    }
    return this._ideaPostsService.usage(org);
  }

  @Post('/')
  generate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: IdeaPostsDto
  ) {
    if (!org?.id) {
      throw new HttpForbiddenException();
    }
    return this._ideaPostsService.generate(org, body);
  }
}
