import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

// The channel menu shows this when DELETE /integrations responds 406.
const postsStillAttached =
  'You have to delete all the posts associated with this channel before deleting it';

@Injectable()
export class IntegrationChannelTool implements AgentToolInterface {
  constructor(
    private _integrationService: IntegrationService,
    private _integrationManager: IntegrationManager
  ) {}
  name = 'integrationChannelTool';

  run() {
    return createTool({
      id: 'integrationChannelTool',
      description: `Manage a channel that is already connected. action "disable" and "enable" turn it off and on. "delete" removes it, and returns the same conflict the channel menu shows when posts are still attached. "nickname" sets the name (and optional picture) through the channel nickname action. "slots" replaces the time slots; each number is minutes from UTC midnight, the same values POST /integrations/:id/time stores. There is no connect action. Confirm with the user before disable, delete, nickname, or slots.`,
      inputSchema: z.object({
        action: z.enum(['enable', 'disable', 'delete', 'nickname', 'slots']),
        id: z.string().describe('Channel id'),
        name: z.string().optional().describe('New nickname, for action nickname'),
        picture: z
          .string()
          .optional()
          .describe('Picture URL, for action nickname when the channel supports it'),
        slots: z
          .array(z.number())
          .optional()
          .describe('Time slots as minutes from UTC midnight, for action slots'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Manage Channel',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context) as {
            id: string;
            subscription?: { totalChannels?: number | null };
          };
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          if (inputData.action === 'disable') {
            await this._integrationService.disableChannel(org.id, inputData.id);
            return { output: { id: inputData.id, disabled: true } };
          }
          if (inputData.action === 'enable') {
            await this._integrationService.enableChannel(
              org.id,
              org.subscription?.totalChannels || pricing.FREE.channel || 0,
              inputData.id
            );
            return { output: { id: inputData.id, disabled: false } };
          }
          if (inputData.action === 'delete') {
            const attached = await this._integrationService.getPostsForChannel(
              org.id,
              inputData.id
            );
            if (attached.length) {
              throw new HttpException(postsStillAttached, 406);
            }
            await this._integrationService.deleteChannel(org.id, inputData.id);
            return { output: { id: inputData.id, deleted: true } };
          }
          if (inputData.action === 'slots') {
            const time = (inputData.slots || []).map((slot: number) => ({
              time: slot,
            }));
            await this._integrationService.setTimes(org.id, inputData.id, { time });
            return { output: { id: inputData.id, time } };
          }
          if (!inputData.name && !inputData.picture) {
            return { output: { error: 'name or picture is required' } };
          }
          const integration = await this._integrationService.getIntegrationById(
            org.id,
            inputData.id
          );
          if (!integration) {
            throw new HttpException('Invalid integration', 400);
          }
          const manager = this._integrationManager.getSocialIntegration(
            integration.providerIdentifier
          );
          if (!manager.changeProfilePicture && !manager.changeNickname) {
            throw new HttpException('Invalid integration', 400);
          }
          const { url } = manager.changeProfilePicture
            ? await manager.changeProfilePicture(
                integration.internalId,
                integration.token,
                inputData.picture || ''
              )
            : { url: '' };
          const { name } = manager.changeNickname
            ? await manager.changeNickname(
                integration.internalId,
                integration.token,
                inputData.name || ''
              )
            : { name: '' };
          const saved = await this._integrationService.updateNameAndUrl(
            inputData.id,
            name,
            url
          );
          return {
            output: {
              id: saved?.id || inputData.id,
              name: saved?.name || name,
              picture: saved?.picture || url,
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
