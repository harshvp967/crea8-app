import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

// The media library returns a signed read URL plus extra fields. Save profile
// stores the media id, so only that id is required here.
export class UserPictureDto {
  @IsString()
  @IsDefined()
  id: string;

  @IsOptional()
  @IsString()
  path?: string;
}

export class UserDetailDto {
  @IsString()
  @MinLength(3)
  fullname: string;

  @IsString()
  @IsOptional()
  bio: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserPictureDto)
  picture?: UserPictureDto | null;
}
