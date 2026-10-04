import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateStalkerKeywordDto {
  @IsString()
  @IsDefined()
  projectId: string;

  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(80)
  phrase: string;

  @IsOptional()
  @IsBoolean()
  youtube?: boolean;

  @IsOptional()
  @IsBoolean()
  reddit?: boolean;

  @IsOptional()
  @IsBoolean()
  x?: boolean;

  @IsOptional()
  @IsBoolean()
  linkedin?: boolean;
}

export class StalkerKeywordInputDto {
  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(80)
  phrase: string;

  @IsOptional()
  @IsBoolean()
  youtube?: boolean;

  @IsOptional()
  @IsBoolean()
  reddit?: boolean;

  @IsOptional()
  @IsBoolean()
  x?: boolean;

  @IsOptional()
  @IsBoolean()
  linkedin?: boolean;
}

export class StalkerCategoryInputDto {
  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class CreateStalkerProjectDto {
  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StalkerKeywordInputDto)
  keywords: StalkerKeywordInputDto[];

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => StalkerCategoryInputDto)
  categories: StalkerCategoryInputDto[];
}

export class StalkerMentionQueryDto {
  @IsString()
  @IsDefined()
  projectId: string;

  @IsOptional()
  @IsIn(['24h', '7d', '30d', 'all'])
  date?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  from?: string;

  @IsOptional()
  @IsString()
  keywordId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @IsIn(['NEW', 'REPLIED', 'IGNORED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minUrgency?: number;
}

export class StalkerMentionStatusDto {
  @IsIn(['NEW', 'REPLIED', 'IGNORED'])
  status: 'NEW' | 'REPLIED' | 'IGNORED';
}

export class StalkerDraftDto {
  @IsOptional()
  @IsString()
  mentionId?: string;

  @IsOptional()
  @IsString()
  themeId?: string;

  @IsIn(['post', 'quote'])
  mode: 'post' | 'quote';
}
