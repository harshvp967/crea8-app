import { IsDefined, IsString, MinLength } from 'class-validator';

export class JoinOrgDto {
  @IsDefined()
  @IsString()
  @MinLength(10)
  org: string;
}
