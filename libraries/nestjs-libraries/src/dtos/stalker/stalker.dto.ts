import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStalkerKeywordDto {
  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(80)
  phrase: string;
}

export class StalkerMentionQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minUrgency?: number;
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
