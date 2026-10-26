import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, User } from '@prisma/client';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { ChangeTeamMemberRoleDto } from '@gitroom/nestjs-libraries/dtos/settings/change.team.member.role.dto';
import { ShortlinkPreferenceDto } from '@gitroom/nestjs-libraries/dtos/settings/shortlink-preference.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('Settings')
@Controller('/settings')
export class SettingsController {
  constructor(
    private _organizationService: OrganizationService
  ) {}

  @Get('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async getTeam(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getTeam(org.id);
  }

  @Post('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async inviteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: AddTeamMemberDto
  ) {
    return this._organizationService.inviteTeamMember(org, user, body);
  }

  @Get('/team/invites')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async listInvites(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.listPendingInvites(org.id);
  }

  @Post('/team/invites/:id/resend')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async resendInvite(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this._organizationService.resendInvite(org, user, id);
  }

  @Post('/team/invites/:id/link')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async copyInviteLink(
    @GetOrgFromRequest() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this._organizationService.copyInviteLink(org.id, id);
  }

  @Delete('/team/invites/:id')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  revokeInvite(
    @GetOrgFromRequest() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this._organizationService.revokeInvite(org.id, id);
  }

  @Post('/team/:id/role')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  updateTeamMemberRole(
    @GetOrgFromRequest() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ChangeTeamMemberRoleDto
  ) {
    return this._organizationService.updateTeamMemberRole(org, id, body.role);
  }

  @Post('/team/add')
  async addTeamMember(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AdminAddTeamMemberDto
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }

    return this._organizationService.addTeamMemberByEmail(org, body);
  }

  @Delete('/team/:id')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  deleteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this._organizationService.deleteTeamMember(org, id);
  }

  @Get('/shortlink')
  async getShortlinkPreference(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getShortlinkPreference(org.id);
  }

  @Post('/shortlink')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async updateShortlinkPreference(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ShortlinkPreferenceDto
  ) {
    return this._organizationService.updateShortlinkPreference(
      org.id,
      body.shortlink
    );
  }
}
