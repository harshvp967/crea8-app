import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';

export class RenameWorkspaceDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;
}
