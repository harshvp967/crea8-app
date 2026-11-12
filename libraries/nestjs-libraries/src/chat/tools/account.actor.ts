import { HttpException } from '@nestjs/common';
import { Organization, User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { ToolOrganization } from '@gitroom/nestjs-libraries/chat/auth.context';

export type AccountActor = {
  user: User;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  organization: Organization;
};

// OAuth carries the authorizing user. An API key is the workspace, so the
// actor is the workspace owner. The user record stays inside the tool.
export async function accountActor(
  users: UsersService,
  organizations: OrganizationService,
  org: ToolOrganization
): Promise<AccountActor> {
  if (org.userId) {
    const user = await users.getUserById(org.userId);
    const memberships = await organizations.getOrgsByUserId(org.userId);
    const membership = memberships.find((item) => item.id === org.id);
    const role = membership?.users?.[0]?.role;
    if (!user || !membership || membership.users[0]?.disabled || !role) {
      throw new HttpException('You do not have permission to do this', 403);
    }
    return shape(user, role, membership.id, membership.name);
  }

  const overview = await organizations.getAccountOverview(org.id);
  const ownerId = overview?.owner?.id;
  if (!ownerId) {
    throw new HttpException('You do not have permission to do this', 403);
  }
  const user = await users.getUserById(ownerId);
  if (!user) {
    throw new HttpException('You do not have permission to do this', 403);
  }
  const memberships = await organizations.getOrgsByUserId(ownerId);
  const membership = memberships.find((item) => item.id === org.id);
  return shape(
    user,
    'SUPERADMIN',
    org.id,
    membership?.name || overview?.organization?.name || ''
  );
}

function shape(
  user: User,
  role: string,
  id: string,
  name: string
): AccountActor {
  const known =
    role === 'ADMIN' || role === 'SUPERADMIN' || role === 'USER'
      ? role
      : 'USER';
  return {
    user,
    role: known,
    organization: {
      id,
      name,
      users: [{ role: known }],
    } as unknown as Organization,
  };
}

// Settings team routes require ADMIN as well as the team-members plan.
export function assertWorkspaceAdmin(actor: AccountActor) {
  if (actor.role !== 'ADMIN' && actor.role !== 'SUPERADMIN') {
    throw new HttpException('You do not have permission to do this', 403);
  }
}
