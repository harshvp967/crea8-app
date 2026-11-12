import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import { webhookQuota } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import {
  WEBHOOK_EVENTS,
  WebhookEventName,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const urlMessage =
  'Webhook URL must be a public HTTPS URL and cannot point to internal network addresses';

// The sample POST /webhooks/send sends from the Developers screen.
const webhookTestBody = [
  {
    id: 'cm6tcts4f0005qcwit25cis26',
    content: 'This is the first post to instagram',
    publishDate: '2025-02-06T13:09:00.000Z',
    releaseURL: 'https://facebook.com/release/release',
    state: 'PUBLISHED',
    integration: {
      id: 'cm6s4uyou0001i2r47pxix6z1',
      name: 'test',
      providerIdentifier: 'instagram',
      picture: 'https://uploads.gitroom.com/F6LSCD8wrrQ.jpeg',
      type: 'social',
    },
  },
  {
    id: 'cm6tcts4f0005qcwit25cis26',
    content: 'This is the second post to facebook',
    publishDate: '2025-02-06T13:09:00.000Z',
    releaseURL: 'https://facebook.com/release2/release2',
    state: 'PUBLISHED',
    integration: {
      id: 'cm6s4uyou0001i2r47pxix6z1',
      name: 'test2',
      providerIdentifier: 'facebook',
      picture: 'https://uploads.gitroom.com/F6LSCD8wrrQ.jpeg',
      type: 'social',
    },
  },
];

function withoutSigningSecret(row: { signingSecret?: unknown }) {
  const { signingSecret, ...rest } = row;
  return rest;
}

@Injectable()
export class WebhooksTool implements AgentToolInterface {
  constructor(
    private _webhooks: WebhooksService,
    private _entitlements: EntitlementService
  ) {}
  name = 'webhooksTool';

  run() {
    return createTool({
      id: 'webhooksTool',
      description: `Manage workspace webhooks, the same records as the Developers screen. action "list" returns them and the webhookQuota string. "create" and "update" save a name, a public HTTPS url, optional channel ids, and optional events. "delete" removes a webhook id. "test" posts the same sample body as POST /webhooks/send to a url. Creating one past the plan quota is refused with that plan's webhook limit. The signing secret is left on the Developers screen. Confirm with the user before create, update, delete, or test.`,
      inputSchema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete', 'test']),
        id: z.string().optional().describe('Webhook id, required for update and delete'),
        name: z.string().optional(),
        url: z.string().optional().describe('Public HTTPS URL. Required for create, update, and test'),
        integrations: z
          .array(z.object({ id: z.string() }))
          .optional()
          .describe('Channel ids. Omit or pass an empty list for every channel'),
        events: z
          .array(z.enum(WEBHOOK_EVENTS as [WebhookEventName, ...WebhookEventName[]]))
          .optional()
          .describe('Event names. Omit on create to keep the Schedule default'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Webhooks',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'list') {
            const [rows, limits, used] = await Promise.all([
              this._webhooks.getWebhooks(org.id),
              this._entitlements.limits(org.id),
              this._entitlements.countWebhooks(org.id),
            ]);
            return {
              output: plain({
                webhooks: rows.map((row) => withoutSigningSecret(row)),
                ...(limits
                  ? { quota: webhookQuota(used, limits.plan.webhooks) }
                  : {}),
              }),
            };
          }
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            return {
              output: plain(
                await this._webhooks.deleteWebhook(org.id, inputData.id)
              ),
            };
          }
          if (inputData.action === 'test') {
            if (!inputData.url) {
              return { output: { error: 'url is required' } };
            }
            await this.requireUrl(inputData.url);
            try {
              await fetch(inputData.url, {
                method: 'POST',
                body: JSON.stringify(webhookTestBody),
                headers: { 'Content-Type': 'application/json' },
              });
            } catch (err) {
              /** sent **/
            }
            return { output: { send: true } };
          }
          if (!inputData.name || !inputData.url) {
            return { output: { error: 'name and url are required' } };
          }
          if (inputData.action === 'update' && !inputData.id) {
            return { output: { error: 'id is required' } };
          }
          await this.requireUrl(inputData.url);
          if (inputData.action === 'create') {
            await this._entitlements.assertCanAddWebhook(org.id);
          }
          const saved = await this._webhooks.createWebhook(org.id, {
            id: inputData.action === 'update' ? inputData.id! : '',
            name: inputData.name,
            url: inputData.url,
            integrations: inputData.integrations || [],
            ...(inputData.events ? { events: inputData.events } : {}),
          });
          return { output: plain(saved) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }

  private async requireUrl(url: string) {
    if (!(await isSafePublicHttpsUrl(url))) {
      throw new HttpException(urlMessage, 400);
    }
  }
}
