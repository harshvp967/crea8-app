import { IntegrationValidationTool } from '@gitroom/nestjs-libraries/chat/tools/integration.validation.tool';
import { IntegrationTriggerTool } from '@gitroom/nestjs-libraries/chat/tools/integration.trigger.tool';
import { IntegrationSchedulePostTool } from './integration.schedule.post';
import { GenerateVideoOptionsTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.options.tool';
import { VideoFunctionTool } from '@gitroom/nestjs-libraries/chat/tools/video.function.tool';
import { GenerateVideoTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.tool';
import { VideoStatusTool } from '@gitroom/nestjs-libraries/chat/tools/video.status.tool';
import { ClippingTool } from '@gitroom/nestjs-libraries/chat/tools/clipping.tool';
import { ClippingStatusTool } from '@gitroom/nestjs-libraries/chat/tools/clipping.status.tool';
import { ClippingWidgetTicketTool } from '@gitroom/nestjs-libraries/chat/tools/clipping.widget.ticket.tool';
import { GenerateImageTool } from '@gitroom/nestjs-libraries/chat/tools/generate.image.tool';
import { GeneratePostsTool } from '@gitroom/nestjs-libraries/chat/tools/generate.posts.tool';
import { IntegrationListTool } from '@gitroom/nestjs-libraries/chat/tools/integration.list.tool';
import { GroupListTool } from '@gitroom/nestjs-libraries/chat/tools/group.list.tool';
import { UploadFromUrlTool } from '@gitroom/nestjs-libraries/chat/tools/upload.from.url.tool';
import { PostsListTool } from '@gitroom/nestjs-libraries/chat/tools/posts.list.tool';
import { UpdatePostTool } from '@gitroom/nestjs-libraries/chat/tools/update.post.tool';
import { DeletePostTool } from '@gitroom/nestjs-libraries/chat/tools/delete.post.tool';
import { PostSettingsTool } from '@gitroom/nestjs-libraries/chat/tools/post.settings.tool';
import { PostDateTool } from '@gitroom/nestjs-libraries/chat/tools/post.date.tool';
import { IntegrationChannelTool } from '@gitroom/nestjs-libraries/chat/tools/integration.channel.tool';
import { SetsTool } from '@gitroom/nestjs-libraries/chat/tools/sets.tool';
import { SignaturesTool } from '@gitroom/nestjs-libraries/chat/tools/signatures.tool';
import { AutopostTool } from '@gitroom/nestjs-libraries/chat/tools/autopost.tool';
import { ShortlinkPreferenceTool } from '@gitroom/nestjs-libraries/chat/tools/shortlink.preference.tool';
import { TeamMembersTool } from '@gitroom/nestjs-libraries/chat/tools/team.members.tool';
import { WorkspaceProfileTool } from '@gitroom/nestjs-libraries/chat/tools/workspace.profile.tool';
import { EmailNotificationsTool } from '@gitroom/nestjs-libraries/chat/tools/email.notifications.tool';
import { WebhooksTool } from '@gitroom/nestjs-libraries/chat/tools/webhooks.tool';
import { ApprovedAppsTool } from '@gitroom/nestjs-libraries/chat/tools/approved.apps.tool';
import { DeveloperTool } from '@gitroom/nestjs-libraries/chat/tools/developer.tool';
import { BillingTool } from '@gitroom/nestjs-libraries/chat/tools/billing.tool';
import { UploadWidgetTool } from '@gitroom/nestjs-libraries/chat/tools/upload.widget.tool';
import { UploadWidgetTicketTool } from '@gitroom/nestjs-libraries/chat/tools/upload.widget.ticket.tool';
import { UploadWidgetStatusTool } from '@gitroom/nestjs-libraries/chat/tools/upload.widget.status.tool';
import { StalkerProjectsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.projects.tool';
import { StalkerMentionsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.mentions.tool';
import { StalkerKeywordsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.keywords.tool';
import { StalkerAlertsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.alerts.tool';
import { StalkerAnalyticsTool } from '@gitroom/nestjs-libraries/chat/tools/stalker.analytics.tool';
import { LinkPageTool } from '@gitroom/nestjs-libraries/chat/tools/link.page.tool';
import { LinkBlocksTool } from '@gitroom/nestjs-libraries/chat/tools/link.blocks.tool';
import { LinkAnalyticsTool } from '@gitroom/nestjs-libraries/chat/tools/link.analytics.tool';
import { LinkLeadsTool } from '@gitroom/nestjs-libraries/chat/tools/link.leads.tool';
import { LinkDomainTool } from '@gitroom/nestjs-libraries/chat/tools/link.domain.tool';

export const toolList = [
  IntegrationListTool,
  GroupListTool,
  IntegrationValidationTool,
  IntegrationTriggerTool,
  IntegrationSchedulePostTool,
  PostsListTool,
  UpdatePostTool,
  DeletePostTool,
  PostSettingsTool,
  PostDateTool,
  IntegrationChannelTool,
  SetsTool,
  SignaturesTool,
  AutopostTool,
  ShortlinkPreferenceTool,
  TeamMembersTool,
  WorkspaceProfileTool,
  EmailNotificationsTool,
  WebhooksTool,
  ApprovedAppsTool,
  DeveloperTool,
  BillingTool,
  GenerateVideoOptionsTool,
  VideoFunctionTool,
  GenerateVideoTool,
  VideoStatusTool,
  ClippingTool,
  ClippingStatusTool,
  ClippingWidgetTicketTool,
  GenerateImageTool,
  GeneratePostsTool,
  UploadFromUrlTool,
  UploadWidgetTool,
  UploadWidgetTicketTool,
  UploadWidgetStatusTool,
  StalkerProjectsTool,
  StalkerMentionsTool,
  StalkerKeywordsTool,
  StalkerAlertsTool,
  StalkerAnalyticsTool,
  LinkPageTool,
  LinkBlocksTool,
  LinkAnalyticsTool,
  LinkLeadsTool,
  LinkDomainTool,
];
