import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  LINK_BLOCK_TYPES,
  LINK_BUTTONS,
  LINK_FONTS,
  LINK_LOCKS,
  LINK_SOCIALS,
  LINK_THEMES,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

const themes = LINK_THEMES.map((item) => item.id);
const buttons = LINK_BUTTONS.map((item) => item.id);
const networks = LINK_SOCIALS.map((item) => item.id);

export class LinkSocialDto {
  @IsString()
  @IsIn(networks)
  network: string;

  @IsString()
  @MaxLength(2000)
  url: string;
}

export class UpdateLinkPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avatarPath?: string;

  @IsOptional()
  @IsIn(themes)
  theme?: string;

  @IsOptional()
  @IsIn(buttons)
  buttonStyle?: string;

  @IsOptional()
  @IsIn([...LINK_FONTS])
  font?: string;

  @IsOptional()
  @IsIn(['colour', 'image'])
  backgroundMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  backgroundImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  hideBadge?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  captureHeading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  captureButton?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  captureConsent?: string;

  @IsOptional()
  @IsBoolean()
  captureAskName?: boolean;

  @IsOptional()
  @IsBoolean()
  captureDoubleOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  captureNotify?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => LinkSocialDto)
  socials?: LinkSocialDto[];
}

export class UpdateLinkSlugDto {
  @IsString()
  @MaxLength(30)
  slug: string;
}

export class FaqItemDto {
  @IsString()
  @MaxLength(160)
  question: string;

  @IsString()
  @MaxLength(800)
  answer: string;
}

export class CarouselImageDto {
  @IsString()
  @MaxLength(2000)
  path: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  alt?: string;
}

export class SaveLinkBlockDto {
  @IsOptional()
  @IsIn([...LINK_BLOCK_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduleOn?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  startsLocal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  endsLocal?: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsIn(['above', 'below'])
  placement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  thumbnail?: string;

  @IsOptional()
  @IsIn(['upload', 'favicon', ''])
  iconMode?: string;

  @IsOptional()
  @IsBoolean()
  spotlight?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsIn([...LINK_LOCKS])
  lockType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  password?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CarouselImageDto)
  images?: CarouselImageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  formButton?: string;

  @IsOptional()
  @IsBoolean()
  formAskName?: boolean;
}

export class UpdateLinkIntegrationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mailchimpKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mailchimpAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  convertkitKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  convertkitForm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearMailchimp?: boolean;

  @IsOptional()
  @IsBoolean()
  clearConvertkit?: boolean;

  @IsOptional()
  @IsBoolean()
  clearWebhook?: boolean;
}

export class ReorderLinkBlocksDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  ids: string[];
}

export class ConnectLinkDomainDto {
  @IsString()
  @MaxLength(253)
  domain: string;
}

export class PublicLinkTrackDto {
  @IsString()
  @MaxLength(80)
  slug: string;

  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmTerm?: string;
}

export class PublicLinkUnlockDto extends PublicLinkTrackDto {
  @IsOptional()
  @IsBoolean()
  age?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  password?: string;
}

export class PublicLinkContactDto extends PublicLinkTrackDto {
  @IsString()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class PublicLinkSubscribeDto extends PublicLinkTrackDto {
  @IsString()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
