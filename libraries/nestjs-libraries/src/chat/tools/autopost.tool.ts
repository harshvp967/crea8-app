import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class AutopostTool implements AgentToolInterface {
  constructor(
    private _autopostService: AutopostService,
    private _entitlements: EntitlementService
  ) {}
  name = 'autopostTool';

  run() {
    return createTool({
      id: 'autopostTool',
      description: `Manage Auto Post, the same records as the Auto Post tab. action "list" returns them. "create" and "update" save a feed. "delete" removes one. "active" turns one on or off. "send" loads a feed URL through the same path as POST /autopost/send. A workspace whose plan does not include autopost is refused. Confirm with the user before create, update, delete, or active.`,
      inputSchema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete', 'active', 'send']),
        id: z.string().optional().describe('Autopost id, required for update, delete, and active'),
        title: z.string().optional(),
        content: z.string().optional(),
        url: z.string().optional().describe('Feed URL for create, update, and send'),
        active: z.boolean().optional(),
        onSlot: z.boolean().optional(),
        syncLast: z.boolean().optional(),
        addPicture: z.boolean().optional(),
        generateContent: z.boolean().optional(),
        lastUrl: z.string().optional(),
        integrations: z
          .array(z.object({ id: z.string() }))
          .optional()
          .describe('Channel ids. Omit or pass an empty list to use every channel'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Autopost',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertCanAutopost(org.id);
          if (inputData.action === 'create') {
            await this._entitlements.assertCanAddWebhook(org.id);
          }
          if (inputData.action === 'list') {
            return { output: await this._autopostService.getAutoposts(org.id) };
          }
          if (inputData.action === 'send') {
            if (!inputData.url) {
              return { output: { error: 'url is required' } };
            }
            return { output: await this._autopostService.loadXML(inputData.url) };
          }
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            await this._autopostService.deleteAutopost(org.id, inputData.id);
            return { output: { deleted: true, id: inputData.id } };
          }
          if (inputData.action === 'active') {
            if (!inputData.id || inputData.active == null) {
              return { output: { error: 'id and active are required' } };
            }
            return {
              output: await this._autopostService.changeActive(
                org.id,
                inputData.id,
                inputData.active
              ),
            };
          }
          if (!inputData.title || !inputData.url) {
            return { output: { error: 'title and url are required' } };
          }
          if (inputData.action === 'update' && !inputData.id) {
            return { output: { error: 'id is required' } };
          }
          const saved = await this._autopostService.createAutopost(
            org.id,
            {
              title: inputData.title,
              content: inputData.content || '',
              url: inputData.url,
              active: inputData.active ?? true,
              onSlot: inputData.onSlot ?? false,
              syncLast: inputData.syncLast ?? false,
              addPicture: inputData.addPicture ?? false,
              generateContent: inputData.generateContent ?? true,
              lastUrl: inputData.lastUrl || '',
              integrations: inputData.integrations || [],
            },
            inputData.action === 'update' ? inputData.id : undefined
          );
          return { output: saved };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
