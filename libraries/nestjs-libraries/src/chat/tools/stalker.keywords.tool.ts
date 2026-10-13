import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  isStalkerEnabled,
  StalkerService,
} from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

@Injectable()
export class StalkerKeywordsTool implements AgentToolInterface {
  constructor(private _stalkerService: StalkerService) {}
  name = 'stalkerKeywordsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerKeywordsTool',
      description: `Manage Stalker keywords for a project. action "list" returns the keywords. "create" adds a phrase (youtube defaults on; pass reddit, x, or linkedin to listen there too). "update" changes sources or the excluded accounts for a keyword id. "delete" removes a keyword id. Confirm with the user before create, update, or delete.`,
      inputSchema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete']),
        projectId: z.string().optional().describe('Required for list and create'),
        id: z.string().optional().describe('Keyword id, required for update and delete'),
        phrase: z.string().optional().describe('Keyword text, required for create'),
        youtube: z.boolean().optional(),
        reddit: z.boolean().optional(),
        x: z.boolean().optional(),
        linkedin: z.boolean().optional(),
        groupId: z.string().optional(),
        excludeAccounts: z.string().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Stalker Keywords',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'list') {
            if (!inputData.projectId) {
              return { output: { error: 'projectId is required' } };
            }
            const rows = await this._stalkerService.keywords(org.id, inputData.projectId);
            return {
              output: {
                keywords: rows.map((row) => ({
                  id: row.id,
                  phrase: row.phrase,
                  youtube: !!row.listenYoutube,
                  reddit: !!row.listenReddit,
                  x: !!row.listenX,
                  linkedin: !!row.listenLinkedin,
                  mentions30d: row.mentions30d,
                  paused: row.paused,
                  lastError: row.lastError || '',
                  groupId: row.groupId || '',
                })),
              },
            };
          }
          if (inputData.action === 'create') {
            if (!inputData.projectId || !inputData.phrase) {
              return { output: { error: 'projectId and phrase are required' } };
            }
            const created = await this._stalkerService.createKeyword(org.id, {
              projectId: inputData.projectId,
              phrase: inputData.phrase,
              youtube: inputData.youtube,
              reddit: inputData.reddit,
              x: inputData.x,
              linkedin: inputData.linkedin,
              groupId: inputData.groupId,
              excludeAccounts: inputData.excludeAccounts,
            });
            return {
              output: {
                id: created.id,
                phrase: created.phrase,
              },
            };
          }
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          if (inputData.action === 'delete') {
            await this._stalkerService.deleteKeyword(org.id, inputData.id);
            return { output: { deleted: true, id: inputData.id } };
          }
          const updated = await this._stalkerService.updateKeyword(org.id, inputData.id, {
            youtube: inputData.youtube,
            reddit: inputData.reddit,
            x: inputData.x,
            linkedin: inputData.linkedin,
            groupId: inputData.groupId,
            excludeAccounts: inputData.excludeAccounts,
          });
          return {
            output: {
              id: updated?.id || inputData.id,
              phrase: updated?.phrase || '',
            },
          };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
