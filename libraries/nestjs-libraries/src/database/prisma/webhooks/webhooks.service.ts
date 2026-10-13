import { Injectable } from '@nestjs/common';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksDto } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { postWebhookSecret } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.signature';

@Injectable()
export class WebhooksService {
  constructor(private _webhooksRepository: WebhooksRepository) {}

  getTotal(orgId: string) {
    return this._webhooksRepository.getTotal(orgId);
  }

  async getWebhooks(orgId: string) {
    const rows = await this._webhooksRepository.getWebhooks(orgId);
    return rows.map((row) => ({
      ...row,
      signingSecret: postWebhookSecret(row.id) || null,
    }));
  }

  createWebhook(orgId: string, body: WebhooksDto) {
    return this._webhooksRepository.createWebhook(orgId, body);
  }

  deleteWebhook(orgId: string, id: string) {
    return this._webhooksRepository.deleteWebhook(orgId, id);
  }
}
