import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { SetsService } from '@gitroom/nestjs-libraries/database/prisma/sets/sets.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class SetsTool implements AgentToolInterface {
  constructor(
    private _setsService: SetsService,
    private _entitlements: EntitlementService
  ) {}
  name = 'setsTool';

  run() {
    return createTool({
      id: 'setsTool',
      description: `Manage content sets, the same records as the Sets tab. action "list" returns them. "create" adds a name and content. "update" changes a set id. "delete" removes a set id. A free workspace is refused, the same block as the Sets tab. Confirm with the user before create, update, or delete.`,
      inputSchema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete']),
        id: z.string().optional().describe('Set id, required for update and delete'),
        name: z.string().optional().describe('Set name, required for create and update'),
        content: z
          .string()
          .optional()
          .describe('Set content, required for create and update'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Sets',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertFeature(org.id, 'postingSets');
          if (inputData.action === 'list') {
            return { output: await this._setsService.getSets(org.id) };
          }
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            await this._setsService.deleteSet(org.id, inputData.id);
            return { output: { deleted: true, id: inputData.id } };
          }
          if (!inputData.name || inputData.content == null) {
            return { output: { error: 'name and content are required' } };
          }
          if (inputData.action === 'update' && !inputData.id) {
            return { output: { error: 'id is required' } };
          }
          const saved = await this._setsService.createSet(org.id, {
            id: inputData.action === 'update' ? inputData.id : undefined,
            name: inputData.name,
            content: inputData.content,
          });
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
