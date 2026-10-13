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

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class StalkerProjectsTool implements AgentToolInterface {
  constructor(private _stalkerService: StalkerService) {}
  name = 'stalkerProjectsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerProjectsTool',
      description: `List Stalker projects for this organization. Each project tracks keywords and mentions. Call this before reading mentions, keywords, or alerts, and pass the project id those tools ask for.`,
      inputSchema: z.object({}),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'List Stalker Projects',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const projects = await this._stalkerService.projects(org.id);
          return {
            output: {
              projects: plain(projects).map((project: any) => ({
                id: project.id,
                name: project.name,
                description: project.description || '',
                color: project.color,
                keywordCount: project._count?.keywords || 0,
                mentionCount: project._count?.mentions || 0,
                alertsEnabled: !!project.alertsEnabled,
                alertEmail: project.alertEmail || '',
                categories: (project.categories || []).map((category: any) => ({
                  id: category.id,
                  name: category.name,
                })),
              })),
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
