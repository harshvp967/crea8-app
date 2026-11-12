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
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

@Injectable()
export class StalkerKeywordsTool implements AgentToolInterface {
  constructor(
    private _stalkerService: StalkerService,
    private _entitlements: EntitlementService
  ) {}
  name = 'stalkerKeywordsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerKeywordsTool',
      description: `Manage Stalker keywords and keyword groups for a project. action "list" returns the keywords. "create" adds a phrase (youtube defaults on; pass reddit, x, or linkedin to listen there too) and can pass groupId from a group you created. "update" changes sources, groupId, or the excluded accounts for a keyword id. "delete" removes a keyword id. "groups" lists groups. "createGroup" adds a group name. "deleteGroup" removes a group id from the keywords screen; a group that still has keywords is refused. Confirm with the user before create, update, delete, createGroup, or deleteGroup.`,
      inputSchema: z.object({
        action: z.enum([
          'list',
          'create',
          'update',
          'delete',
          'groups',
          'createGroup',
          'deleteGroup',
        ]),
        projectId: z
          .string()
          .optional()
          .describe('Required for list, create, groups, createGroup, and deleteGroup'),
        id: z
          .string()
          .optional()
          .describe('Keyword id for update and delete. Group id for deleteGroup'),
        phrase: z.string().optional().describe('Keyword text, required for create'),
        name: z.string().optional().describe('Group name, required for createGroup'),
        youtube: z.boolean().optional(),
        reddit: z.boolean().optional(),
        x: z.boolean().optional(),
        linkedin: z.boolean().optional(),
        groupId: z
          .string()
          .optional()
          .describe('Keyword group id. Pass a group created with createGroup'),
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
          await this._entitlements.assertCanUseStalker(org.id);
          if (inputData.action === 'groups') {
            if (!inputData.projectId) {
              return { output: { error: 'projectId is required' } };
            }
            const rows = await this._stalkerService.groups(org.id, inputData.projectId);
            return {
              output: {
                groups: rows.map((row) => ({
                  id: row.id,
                  name: row.name,
                  position: row.position,
                  keywordCount: row._count?.keywords || 0,
                })),
              },
            };
          }
          if (inputData.action === 'createGroup') {
            if (!inputData.projectId || !inputData.name) {
              return { output: { error: 'projectId and name are required' } };
            }
            const created = await this._stalkerService.createGroup(
              org.id,
              inputData.projectId,
              inputData.name
            );
            return { output: { id: created.id, name: created.name } };
          }
          if (inputData.action === 'deleteGroup') {
            if (!inputData.projectId || !inputData.id) {
              return { output: { error: 'projectId and id are required' } };
            }
            return {
              output: await this._stalkerService.deleteGroup(
                org.id,
                inputData.projectId,
                inputData.id
              ),
            };
          }
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
            await this._entitlements.assertCanAddKeyword(org.id);
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
