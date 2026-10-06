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

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  excludeAccounts?: string;
}

export class UpdateStalkerKeywordDto {
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

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  excludeAccounts?: string;
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

export class StalkerIdentityDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  aliases?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  exclusions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleX?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleRedditUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleRedditSubreddit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleYoutube?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleLinkedin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleInstagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  handleFacebook?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  alertEmail?: string;

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;

  @IsOptional()
  @IsIn(['URGENT', 'NEGATIVE', 'ALL'])
  alertScope?: 'URGENT' | 'NEGATIVE' | 'ALL';

  @IsOptional()
  @IsIn(['INSTANT', 'DIGEST'])
  alertDelivery?: 'INSTANT' | 'DIGEST';

  @IsOptional()
  @IsBoolean()
  spikeEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  spikeMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  sentimentDropEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(80)
  sentimentDropPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  alertCooldownHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  publicDashboard?: boolean;

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  digestDismissed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  digestTimezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  digestGroupName?: string;
}

export class CreateStalkerProjectDto extends StalkerIdentityDto {
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

export class UpdateStalkerProjectDto extends StalkerIdentityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}

export class StalkerViewFiltersDto {
  @IsOptional()
  @IsIn(['24h', '7d', '30d', 'all'])
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
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
  @MaxLength(20)
  sentiment?: string;

  @IsOptional()
  @IsIn(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['BRAND', 'ALIAS', 'HANDLE', 'KEYWORD'])
  match?: string;

  @IsOptional()
  @IsIn(['include'])
  offTopic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  start?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sources?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  engagement?: string;
}

export class CreateStalkerViewDto {
  @IsString()
  @IsDefined()
  projectId: string;

  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => StalkerViewFiltersDto)
  filters: StalkerViewFiltersDto;
}

export class StalkerReplyDto {
  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

export class StalkerSaveMentionDto {
  @IsBoolean()
  saved: boolean;

  @IsOptional()
  @IsIn(['testimonial', 'idea'])
  as?: 'testimonial' | 'idea';
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
  @MaxLength(20)
  start?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  end?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  engagement?: string;

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
  @IsIn(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minUrgency?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['BRAND', 'ALIAS', 'HANDLE', 'KEYWORD'])
  match?: string;

  @IsOptional()
  @IsIn(['include'])
  offTopic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class StalkerMentionStatusDto {
  @IsIn(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP'])
  status: 'NEW' | 'REPLIED' | 'IGNORED' | 'DONE' | 'FOLLOW_UP';
}

export class StalkerMentionRelevantDto {
  @IsBoolean()
  relevant: boolean;
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

export class CreateStalkerGroupDto {
  @IsString()
  @IsDefined()
  projectId: string;

  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(40)
  name: string;
}

export class CreateStalkerAlertRuleDto {
  @IsString()
  @IsDefined()
  projectId: string;

  @IsString()
  @IsDefined()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => StalkerViewFiltersDto)
  filters: StalkerViewFiltersDto;
}

export class StalkerCategoryWriteDto extends StalkerCategoryInputDto {
  @IsOptional()
  @IsString()
  id?: string;
}

export class SaveStalkerCategoriesDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => StalkerCategoryWriteDto)
  categories: StalkerCategoryWriteDto[];
}
