import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import { LINK_BLOCK_TYPES } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class LinkBlocksTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkBlocksTool';

  run() {
    return createTool({
      id: 'linkBlocksTool',
      description: `Edit Link-in-Bio blocks. action "create" adds a block (type LINK needs title and url). "update" changes a block id. "delete" removes a block id. "reorder" sets the order from an array of block ids. Read the page with linkPageTool first. Confirm with the user before changing blocks. Block types: ${LINK_BLOCK_TYPES.join(', ')}.`,
      inputSchema: z.object({
        action: z.enum(['create', 'update', 'delete', 'reorder']),
        id: z.string().optional().describe('Block id for update and delete'),
        ids: z.array(z.string()).optional().describe('Block ids in the new order, for reorder'),
        type: z.enum(LINK_BLOCK_TYPES).optional(),
        title: z.string().optional(),
        url: z.string().optional(),
        body: z.string().optional(),
        enabled: z.boolean().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Edit Link-in-Bio Blocks',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'reorder') {
            if (!inputData.ids?.length) {
              return { output: { error: 'ids is required' } };
            }
            return { output: plain(await this._linkService.reorder(org, inputData.ids)) };
          }
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            return { output: plain(await this._linkService.deleteBlock(org, inputData.id)) };
          }
          if (inputData.action === 'update' && !inputData.id) {
            return { output: { error: 'id is required' } };
          }
          const page = await this._linkService.saveBlock(
            org,
            inputData.action === 'update' ? inputData.id! : null,
            {
              type: inputData.type,
              title: inputData.title,
              url: inputData.url,
              body: inputData.body,
              enabled: inputData.enabled,
            }
          );
          return { output: plain(page) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
