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

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class StalkerAlertsTool implements AgentToolInterface {
  constructor(
    private _stalkerService: StalkerService,
    private _entitlements: EntitlementService
  ) {}
  name = 'stalkerAlertsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerAlertsTool',
      description: `Manage Stalker alerts for a project. action "list" returns fired alerts. "rules" lists saved alert rules. "create" adds a rule (name plus optional filters such as sentiment, status, source, or q). "update" edits a rule id the same way as the alerts screen: pass name, enabled, or filters, and anything you omit stays as it is. "delete" removes a rule id. "read" marks one fired alert id as read. Confirm with the user before create, update, or delete.`,
      inputSchema: z.object({
        action: z.enum(['list', 'rules', 'create', 'update', 'delete', 'read']),
        projectId: z.string().optional().describe('Required for list, rules, and create'),
        id: z.string().optional().describe('Alert id for read. Rule id for update and delete'),
        name: z.string().optional().describe('Rule name, required for create. Optional on update'),
        enabled: z.boolean().optional().describe('Turn a rule on or off. Used by update'),
        cursor: z.string().optional(),
        take: z.number().int().min(1).max(50).optional(),
        filters: z
          .object({
            date: z.enum(['24h', '7d', '30d', 'all']).optional(),
            source: z.string().optional(),
            sentiment: z.string().optional(),
            status: z.enum(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP']).optional(),
            q: z.string().optional(),
            keywordId: z.string().optional(),
          })
          .optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Stalker Alerts',
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
          if (inputData.action === 'list' || inputData.action === 'rules' || inputData.action === 'create') {
            if (!inputData.projectId) {
              return { output: { error: 'projectId is required' } };
            }
          }
          if (inputData.action === 'list') {
            const page = await this._stalkerService.alerts(
              org.id,
              inputData.projectId!,
              inputData.cursor,
              inputData.take
            );
            return { output: plain(page) };
          }
          if (inputData.action === 'rules') {
            return {
              output: { rules: plain(await this._stalkerService.alertRules(org.id, inputData.projectId!)) },
            };
          }
          if (inputData.action === 'create') {
            if (!inputData.name) {
              return { output: { error: 'name is required' } };
            }
            const rule = await this._stalkerService.createAlertRule(
              org.id,
              inputData.projectId!,
              inputData.name,
              inputData.filters || {}
            );
            return { output: plain(rule) };
          }
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          if (inputData.action === 'read') {
            return { output: await this._stalkerService.markAlertRead(org.id, inputData.id) };
          }
          if (inputData.action === 'update') {
            const body: {
              name?: string;
              enabled?: boolean;
              filters?: NonNullable<typeof inputData.filters>;
            } = {};
            if (typeof inputData.name === 'string') body.name = inputData.name;
            if (typeof inputData.enabled === 'boolean') body.enabled = inputData.enabled;
            if (inputData.filters) body.filters = inputData.filters;
            if (!('name' in body) && !('enabled' in body) && !('filters' in body)) {
              return { output: { error: 'name, enabled, or filters is required' } };
            }
            return {
              output: await this._stalkerService.updateAlertRule(org.id, inputData.id, body),
            };
          }
          return { output: await this._stalkerService.deleteAlertRule(org.id, inputData.id) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
