import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { SignatureService } from '@gitroom/nestjs-libraries/database/prisma/signatures/signature.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class SignaturesTool implements AgentToolInterface {
  constructor(
    private _signatureService: SignatureService,
    private _entitlements: EntitlementService
  ) {}
  name = 'signaturesTool';

  run() {
    return createTool({
      id: 'signaturesTool',
      description: `Manage signatures, the same records as the Signatures tab. action "list" returns them. "create" and "update" save content and whether it is the default (autoAdd). "delete" removes a signature id. "default" reads the default signature, the same value as GET /signatures/default. A free workspace is refused, the same block as the Signatures tab. Confirm with the user before create, update, or delete.`,
      inputSchema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete', 'default']),
        id: z.string().optional().describe('Signature id, required for update and delete'),
        content: z.string().optional().describe('Signature text, required for create and update'),
        autoAdd: z
          .boolean()
          .optional()
          .describe('True when this signature is added to posts automatically'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Signatures',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          // The Signatures tab is hidden on Free, the same plan line as sets.
          await this._entitlements.assertFeature(org.id, 'postingSets');
          if (inputData.action === 'list') {
            return {
              output: await this._signatureService.getSignaturesByOrgId(org.id),
            };
          }
          if (inputData.action === 'default') {
            return {
              output:
                (await this._signatureService.getDefaultSignature(org.id)) || {},
            };
          }
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            return {
              output: await this._signatureService.deleteSignature(
                org.id,
                inputData.id
              ),
            };
          }
          if (inputData.content == null || inputData.autoAdd == null) {
            return { output: { error: 'content and autoAdd are required' } };
          }
          if (inputData.action === 'update' && !inputData.id) {
            return { output: { error: 'id is required' } };
          }
          const saved = await this._signatureService.createOrUpdateSignature(
            org.id,
            { content: inputData.content, autoAdd: inputData.autoAdd },
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
