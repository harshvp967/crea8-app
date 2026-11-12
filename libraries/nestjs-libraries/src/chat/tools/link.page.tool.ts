import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import { LINK_FONTS } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const colour = z.string().optional();

@Injectable()
export class LinkPageTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkPageTool';

  run() {
    return createTool({
      id: 'linkPageTool',
      description: `Read or edit the Link-in-Bio page. action "read" returns the page, its links, and its blocks. action "update" changes only the fields you pass: name, bio, slug, isPublic, theme, buttonStyle, seoTitle, seoDescription, avatarPath, font, backgroundMode, backgroundColor, backgroundImage, colors, ogImage, sensitive, and hideBadge. Those fields go through the same page update as the settings and appearance screens. A pro theme or badge removal on a free page is refused with the same payment-required error as the screen. Confirm with the user before update. Get block ids from a read before editing blocks with linkBlocksTool.`,
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
        avatarPath: z
          .string()
          .optional()
          .describe('Avatar image path or URL, the same field as the appearance screen'),
        font: z.enum(LINK_FONTS).optional(),
        backgroundMode: z
          .enum(['colour', 'image'])
          .optional()
          .describe('Page background: a colour or an image'),
        backgroundColor: z.string().optional(),
        backgroundImage: z
          .string()
          .optional()
          .describe('Background image path or URL when backgroundMode is image'),
        colors: z
          .object({
            background: colour,
            button: colour,
            buttonText: colour,
            pageText: colour,
            title: colour,
          })
          .optional()
          .describe('Design colours from the appearance screen'),
        ogImage: z
          .string()
          .optional()
          .describe('Open Graph image, the same field as the settings screen'),
        sensitive: z.boolean().optional().describe('Sensitive-content warning'),
        hideBadge: z
          .boolean()
          .optional()
          .describe('Hide the crea8.one badge. A free page is refused'),
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
          const design =
            inputData.ogImage !== undefined || inputData.colors
              ? {
                  ...(inputData.ogImage !== undefined ? { ogImage: inputData.ogImage } : {}),
                  ...(inputData.colors ? { colors: inputData.colors } : {}),
                }
              : undefined;
          const page = await this._linkService.update(org, {
            name: inputData.name,
            bio: inputData.bio,
            avatarPath: inputData.avatarPath,
            isPublic: inputData.isPublic,
            theme: inputData.theme as never,
            buttonStyle: inputData.buttonStyle as never,
            font: inputData.font,
            backgroundMode: inputData.backgroundMode,
            backgroundColor: inputData.backgroundColor,
            backgroundImage: inputData.backgroundImage,
            seoTitle: inputData.seoTitle,
            seoDescription: inputData.seoDescription,
            sensitive: inputData.sensitive,
            hideBadge: inputData.hideBadge,
            ...(design ? { design } : {}),
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
