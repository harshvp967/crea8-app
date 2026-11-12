import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { HttpException, Injectable } from '@nestjs/common';
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

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const projectView = (project: any, categories?: any[]) => {
  const rows = categories === undefined ? project?.categories || [] : categories;
  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    color: project.color,
    publicDashboard: !!project.publicDashboard,
    keywordCount: project._count?.keywords || 0,
    mentionCount: project._count?.mentions || 0,
    alertsEnabled: !!project.alertsEnabled,
    alertEmail: project.alertEmail || '',
    categories: rows.map((category: any) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
    })),
  };
};

// The Check button reads the latest run, and on 429 shows that run plus when
// the next check is allowed.
const checkLimit = (err: unknown) => {
  if (!(err instanceof HttpException) || err.getStatus() !== 429) {
    return undefined;
  }
  const response = err.getResponse();
  if (typeof response === 'string') {
    return { notice: response, retryAt: undefined as string | undefined };
  }
  const body = response as { message?: unknown; retryAt?: unknown };
  const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  return {
    notice:
      typeof message === 'string' && message
        ? message
        : 'A check just ran. Try again in a few minutes',
    retryAt: typeof body.retryAt === 'string' ? body.retryAt : undefined,
  };
};

const keywordInput = z.object({
  phrase: z.string(),
  youtube: z.boolean().optional(),
  reddit: z.boolean().optional(),
  x: z.boolean().optional(),
  linkedin: z.boolean().optional(),
});

const categoryInput = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
});

@Injectable()
export class StalkerProjectsTool implements AgentToolInterface {
  constructor(
    private _stalkerService: StalkerService,
    private _entitlements: EntitlementService
  ) {}
  name = 'stalkerProjectsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerProjectsTool',
      description: `Manage Stalker projects for this organization. action "list" (the default) returns the projects. "create" adds one: name, color, keywords, and at least one category, the same fields as the new-project screen. "update" changes name, description, color, and publicDashboard, then categories when you pass them, the same two saves as the project settings screen. "delete" removes a project id. "scan" starts Check now for a project and returns the same status the Check button shows. A workspace with no active plan, or one past its keyword or daily check limit, is refused with that plan limit. The scan still charges read credits the same way as Check now. Get a project id from list before the other Stalker tools. Confirm with the user before create, update, delete, or scan.`,
      inputSchema: z.object({
        action: z
          .enum(['list', 'create', 'update', 'delete', 'scan'])
          .optional()
          .describe('Defaults to list'),
        projectId: z
          .string()
          .optional()
          .describe('Project id. Required for update, delete, and scan'),
        name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional().describe('Project colour, such as #7e47eb'),
        publicDashboard: z.boolean().optional(),
        brandName: z.string().optional(),
        keywords: z.array(keywordInput).optional().describe('Required for create'),
        categories: z
          .array(categoryInput)
          .optional()
          .describe('Required for create. On update, replaces the settings-screen categories'),
        handleX: z.string().optional(),
        handleYoutube: z.string().optional(),
        handleLinkedin: z.string().optional(),
        handleInstagram: z.string().optional(),
        handleFacebook: z.string().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Stalker Projects',
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
          const action = inputData.action || 'list';
          if (action === 'list') {
            const projects = await this._stalkerService.projects(org.id);
            return {
              output: {
                projects: plain(projects).map((project: any) => projectView(project)),
              },
            };
          }
          if (action === 'create') {
            if (!inputData.name || !inputData.color) {
              return { output: { error: 'name and color are required' } };
            }
            if (!inputData.categories?.length) {
              return { output: { error: 'categories are required' } };
            }
            if ((inputData.keywords || []).length) {
              await this._entitlements.assertCanAddKeyword(org.id);
            }
            const created = await this._stalkerService.createProject(org.id, {
              name: inputData.name,
              description: inputData.description,
              color: inputData.color,
              brandName: inputData.brandName,
              keywords: inputData.keywords || [],
              categories: inputData.categories,
              handleX: inputData.handleX,
              handleYoutube: inputData.handleYoutube,
              handleLinkedin: inputData.handleLinkedin,
              handleInstagram: inputData.handleInstagram,
              handleFacebook: inputData.handleFacebook,
            });
            return { output: projectView(created) };
          }
          if (!inputData.projectId) {
            return { output: { error: 'projectId is required' } };
          }
          if (action === 'delete') {
            return {
              output: await this._stalkerService.deleteProject(org.id, inputData.projectId),
            };
          }
          if (action === 'scan') {
            await this._entitlements.assertCanManualCheck(org.id);
            return { output: await this.scanNow(org.id, inputData.projectId) };
          }
          const hasProject =
            inputData.name !== undefined ||
            inputData.description !== undefined ||
            inputData.color !== undefined ||
            typeof inputData.publicDashboard === 'boolean';
          const hasCategories = inputData.categories !== undefined;
          if (!hasProject && !hasCategories) {
            return {
              output: {
                error: 'name, description, color, publicDashboard, or categories is required',
              },
            };
          }
          let project: any = null;
          if (hasProject) {
            project = await this._stalkerService.updateProject(org.id, inputData.projectId, {
              name: inputData.name,
              description: inputData.description,
              color: inputData.color,
              publicDashboard: inputData.publicDashboard,
            });
          } else {
            const projects = await this._stalkerService.projects(org.id);
            project = plain(projects).find((item: any) => item.id === inputData.projectId) || null;
          }
          const categories = hasCategories
            ? await this._stalkerService.saveCategories(
                org.id,
                inputData.projectId,
                inputData.categories || []
              )
            : undefined;
          if (!project) {
            return { output: { error: 'Project not found' } };
          }
          return { output: projectView(project, categories) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }

  private async scanNow(organizationId: string, projectId: string) {
    try {
      const started = await this._stalkerService.requestScan(
        organizationId,
        projectId,
        'manual'
      );
      if (started.status === 'queued' || started.status === 'running') {
        const latest = await this._stalkerService
          .latestScan(organizationId, projectId)
          .catch(() => null);
        if (
          latest &&
          latest.status !== 'idle' &&
          (latest.runId === started.runId ||
            latest.status === 'queued' ||
            latest.status === 'running')
        ) {
          return plain({ ...latest, projectId });
        }
      }
      return plain(started);
    } catch (err) {
      const limited = checkLimit(err);
      if (!limited) {
        throw err;
      }
      const latest = await this._stalkerService
        .latestScan(organizationId, projectId)
        .catch(() => null);
      const base =
        latest && latest.status !== 'idle' ? latest : { status: 'failed', sources: [] };
      return plain({ ...base, projectId, ...limited });
    }
  }
}
