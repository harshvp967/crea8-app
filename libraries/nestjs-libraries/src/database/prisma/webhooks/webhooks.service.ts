import { Injectable } from '@nestjs/common';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksDto } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import {
  postWebhookHeaders,
  postWebhookSecret,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.signature';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import {
  eventsOrScheduleDefault,
  isScheduleWebhookEvent,
  ScheduleWebhookEvent,
  WEBHOOK_EVENT,
  WebhookEventName,
  webhookMatchesIntegration,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';

// Same request PostActivity.sendWebhooks builds: post JSON, these headers,
// no timeout. Schedule delivery stays on this shape.
async function postWebhook(url: string, webhookId: string, payload: string, timeoutMs?: number) {
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...postWebhookHeaders(payload, webhookId),
    },
    body: payload,
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    // @ts-ignore — undici option, not in lib.dom fetch types
    dispatcher: getSsrfSafeDispatcher(),
  });
}

// post.published always sends JSON.stringify(post), including an empty list.
// post.failed skips an empty list so a missing row does not POST "[]".
export async function deliverLoadedSchedulePost(
  webhooks: Pick<WebhooksService, 'deliverSchedule'>,
  post: unknown,
  orgId: string,
  integrationId: string,
  event: ScheduleWebhookEvent
) {
  if (event === WEBHOOK_EVENT.postFailed && Array.isArray(post) && post.length === 0) {
    return;
  }
  await webhooks.deliverSchedule(orgId, integrationId, event, JSON.stringify(post));
}

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
      events: eventsOrScheduleDefault(row.events),
      signingSecret: postWebhookSecret(row.id) || null,
    }));
  }

  createWebhook(orgId: string, body: WebhooksDto) {
    return this._webhooksRepository.createWebhook(orgId, body);
  }

  deleteWebhook(orgId: string, id: string) {
    return this._webhooksRepository.deleteWebhook(orgId, id);
  }

  // Schedule only. Body is the caller-supplied payload, not an event envelope.
  // Integration filter matches PostActivity.sendWebhooks.
  async deliverSchedule(
    orgId: string,
    integrationId: string,
    event: ScheduleWebhookEvent,
    payload: string
  ) {
    try {
      if (!isScheduleWebhookEvent(event)) {
        return;
      }
      const rows = await this._webhooksRepository.getWebhooksForEvent(orgId, event);
      const webhooks = rows.filter((row) =>
        webhookMatchesIntegration(row.integrations, integrationId)
      );
      await Promise.all(
        webhooks.map(async (webhook) => {
          try {
            await postWebhook(webhook.url, webhook.id, payload);
          } catch (err) {
            /** empty */
          }
        })
      );
    } catch (err) {
      /** empty */
    }
  }

  async emit(orgId: string, event: WebhookEventName, body: unknown) {
    return this.emitAll(orgId, event, [body]);
  }

  // One subscriber query, then one POST per body. Schedule events are refused
  // here so a post payload cannot be wrapped by mistake.
  async emitAll(orgId: string, event: WebhookEventName, bodies: unknown[]) {
    try {
      if (!bodies.length || isScheduleWebhookEvent(event)) {
        return;
      }
      const rows = await this._webhooksRepository.getWebhooksForEvent(orgId, event);
      if (!rows.length) {
        return;
      }
      await Promise.all(
        bodies.flatMap((body) => {
          const payload = JSON.stringify(body);
          return rows.map(async (webhook) => {
            try {
              await postWebhook(webhook.url, webhook.id, payload, 8000);
            } catch (err) {
              /** empty */
            }
          });
        })
      );
    } catch (err) {
      /** empty */
    }
  }
}
