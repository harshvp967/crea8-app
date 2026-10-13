import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class LinkPageTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkPageTool';

  run() {
    return createTool({
      id: 'linkPageTool',
      description: `Read or edit the Link-in-Bio page. action "read" returns the page, its links, and its blocks. action "update" changes only the fields you pass (name, bio, slug, isPublic, theme, buttonStyle, seoTitle, seoDescription). Confirm with the user before update. Get block ids from a read before editing blocks with linkBlocksTool.`,
      inputSchema: z.object({
        action: z.enum(['read', 'update']),
        name: z.string().optional(),
        bio: z.string().optional(),
        slug: z.string().optional().describe('Public username. Only sent on update.'),
        isPublic: z.boolean().optional(),
        theme: z.string().optional(),
        buttonStyle: z.string().optional(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Link-in-Bio Page',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'read') {
            return { output: plain(await this._linkService.page(org)) };
          }
          if (inputData.slug) {
            await this._linkService.setSlug(org, inputData.slug);
          }
          const page = await this._linkService.update(org, {
            name: inputData.name,
            bio: inputData.bio,
            isPublic: inputData.isPublic,
            theme: inputData.theme as never,
            buttonStyle: inputData.buttonStyle as never,
            seoTitle: inputData.seoTitle,
            seoDescription: inputData.seoDescription,
          });
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
