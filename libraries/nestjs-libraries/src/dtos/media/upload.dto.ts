import { IsDefined, IsString, Matches, Validate } from 'class-validator';
import { ValidUrlExtension } from '@gitroom/helpers/utils/valid.url.path';
import { IsSafeWebhookUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

export class UploadDto {
  @IsString()
  @IsDefined()
  @Validate(ValidUrlExtension)
  @IsSafeWebhookUrl({
    message:
      'URL must be a public HTTPS URL and cannot point to internal network addresses',
  })
  url: string;
}

export class LocalUploadPathDto {
  @IsString()
  @Matches(/^(\d{4}\/\d{2}\/\d{2}\/)?[a-zA-Z0-9._-]{1,180}$/)
  path: string;
}
