import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  deliverLoadedSchedulePost,
  WebhooksService,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { ScheduleWebhookEvent } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';

// New activity. PostActivity.sendWebhooks is unchanged and still serves
// in-flight postWorkflowV112 runs. This one adds the event argument.
@Injectable()
@Activity()
export class WorkspaceWebhookActivity {
  constructor(
    private _postService: PostsService,
    private _webhookService: WebhooksService
  ) {}

  @ActivityMethod()
  async sendScheduleWebhooks(
    postId: string,
    orgId: string,
    integrationId: string,
    event: ScheduleWebhookEvent
  ) {
    // Best-effort, same as sendWebhooks: a delivery failure must not fail the post.
    try {
      const post = await this._postService.getPostByForWebhookId(postId, integrationId);
      await deliverLoadedSchedulePost(this._webhookService, post, orgId, integrationId, event);
    } catch (err) {
      /**empty**/
    }
  }
}
