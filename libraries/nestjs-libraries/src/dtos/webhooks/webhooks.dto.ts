import { IsArray, IsDefined, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { IsSafeWebhookUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { WEBHOOK_EVENTS } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';

export class WebhooksIntegrationDto {
  @IsString()
  @IsDefined()
  id: string;
}

export class WebhooksDto {
  id: string;

  @IsString()
  @IsDefined()
  name: string;

  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'Webhook URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;

  @Type(() => WebhooksIntegrationDto)
  @IsDefined()
  integrations: WebhooksIntegrationDto[];

  // Omitted on create: the column default is Schedule post published and post failed.
  // Omitted on update: the stored selection is left as it is.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: string[];
}

export class OnlyURL {
  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;
}

export class UpdateDto {
  @IsString()
  @IsDefined()
  id: string;

  @IsString()
  @IsDefined()
  name: string;

  @IsString()
  @IsUrl()
  @IsDefined()
  @IsSafeWebhookUrl({
    message:
      'Webhook URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;

  @Type(() => WebhooksIntegrationDto)
  @IsDefined()
  integrations: WebhooksIntegrationDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: string[];
}
