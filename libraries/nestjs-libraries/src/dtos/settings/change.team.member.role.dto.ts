import { IsDefined, IsIn, IsString } from 'class-validator';

export class ChangeTeamMemberRoleDto {
  @IsDefined()
  @IsString()
  @IsIn(['USER', 'ADMIN'])
  role: 'USER' | 'ADMIN';
}
