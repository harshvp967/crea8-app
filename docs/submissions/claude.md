# Claude connector directory

## Name

crea8.one

## Description

crea8.one lets Claude list connected channels, schedule or publish posts, edit a post with `update_post`, delete a post with `delete_post` only when `confirm` is true and the user has confirmed, generate drafts with `generatePostsTool`, upload media from a URL, read and edit the Link-in-Bio page, read Stalker mentions, manage Stalker keywords and alerts, and read account and billing. This connector omits image generation, video generation, and clipping. Those stay on `https://mcp.crea8.one/mcp-oauth-dynamic`. The user signs in with OAuth.

## MCP URL

`https://mcp.crea8.one/mcp-oauth-claude`

Dynamic client registration. Claude-safe tool list.

Issuer: `https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-dynamic`

Protected resource: `https://mcp.crea8.one/.well-known/oauth-protected-resource/mcp-oauth-claude`

`https://api.crea8.one` is the same API process and keeps the same paths. `grant_types_supported` on that issuer is `authorization_code` and `refresh_token`.

Full tool list, including media generation and clipping: `https://mcp.crea8.one/mcp-oauth-dynamic`.

## Tools

Hidden on `/mcp-oauth-claude`:

- generateImageTool
- generateVideoOptions
- videoFunctionTool
- generateVideoTool
- videoStatusTool
- clippingTool
- clippingStatusTool
- clippingWidgetTicketTool

The clipping widget resource is hidden with those tools. The upload widget stays.

Account tools are `workspaceProfileTool`, `emailNotificationsTool`, `teamMembersTool`, `approvedAppsTool`, `developerTool`, and `shortlinkPreferenceTool`. Billing is `billingTool`. Link-in-Bio tools start with `link`. Stalker tools are registered only when `STALKER_ENABLED=true`.

`delete_post` is refused unless `confirm` is true. The client must confirm with the user before calling it. `update_post` is the Schedule composer save. The client must confirm with the user before saving. `generatePostsTool` returns drafts and does not schedule or publish.

| Tool | On this connector | Read only | Open world | Destructive | Justification |
| --- | --- | --- | --- | --- | --- |
| integrationList | Yes | true | false | false | Lists connected channels for this organization. Optional group id filter. It does not change a channel. Reads crea8.one only. It does not call a social network. Does not delete, overwrite, disconnect, or publish. |
| groupList | Yes | true | false | false | Lists customer groups for this organization. Reads crea8.one only. Does not delete or change a group. |
| integrationSchema | Yes | true | false | false | Returns posting rules, length limits, settings schema, and helper names for one platform. Reads crea8.one only. Does not delete, overwrite, or publish. |
| triggerTool | Yes | false | true | true | Calls a platform helper from integrationSchema. It can refresh a stored channel token. Calls the connected social network and can update the stored token for that channel. A failed refresh can mark the channel as needing reconnect, which overwrites the stored auth state. |
| schedulePostTool | Yes | false | true | true | Creates a draft, a scheduled post, or an immediate post. Can publish or schedule content on an external social channel. Can send a public post now or later. It does not delete an existing post. |
| postsListTool | Yes | true | false | false | Lists posts between two UTC dates, including content, state, channel, and settings. Reads crea8.one only. Does not delete, edit, or publish. |
| postSettingsTool | Yes | false | false | false | Merges provider settings into a scheduled post or draft that is not published yet. Content and date stay. Writes only the settings stored on that crea8.one post. Does not delete the post, change its text, change its date, or publish it. |
| postDateTool | Yes | false | false | false | Moves a post's publish time the same way as the calendar date change. It does not republish. Writes only the publish time stored on that crea8.one post. Does not delete the post or publish it again. |
| update_post | Yes | false | true | false | Edits an existing post the same way as the Schedule composer: text, media, time, and channels. type defaults to update, which saves without publishing again. type schedule or now can publish, and an already-published post then needs republish true. The client must confirm with the user before saving. Saving with type schedule or now can publish to an external social channel. type update stays inside crea8.one. Does not delete the post. Publishing again is refused unless republish is true. |
| delete_post | Yes | false | false | true | Deletes a post group the same way as the Schedule calendar. The call is refused unless confirm is true. The client must confirm with the user before calling. allChannels true also deletes the other channels created with it. Deletes rows stored in crea8.one. It does not call a social network to remove an already published post. Removes the post and its comments. This cannot be undone from the tool. |
| integrationChannelTool | Yes | false | false | true | Enables, disables, deletes, renames, or sets time slots on a channel that is already connected. There is no connect action. Changes the channel record in crea8.one. It does not connect a new social account. Delete removes the channel. If posts are still attached, the delete is refused until those posts are removed. |
| setsTool | Yes | false | false | true | Lists, creates, updates, or deletes content sets. A free workspace is refused. Writes only crea8.one set records. Delete removes a set. |
| signaturesTool | Yes | false | false | true | Lists, creates, updates, deletes, or reads the default signature. A free workspace is refused. Writes only crea8.one signature records. Delete removes a signature. |
| autopostTool | Yes | false | true | true | Lists, creates, updates, deletes, turns on or off, or loads an autopost feed. A plan without autopost is refused. send loads a feed URL. Create and update store that URL. Delete removes a feed. Turning a feed off stops future posts from it. |
| shortlinkPreferenceTool | Yes | false | false | false | Reads or sets the workspace shortlink preference to ask, always, or never. Writes only that preference in crea8.one. It does not shorten a link by itself. Does not delete posts or change a per-post shortLink flag. |
| teamMembersTool | Yes | false | false | true | Lists members and invites, or invites, resends, creates an invite link, cancels an invite, changes a role, or removes a member. A plan without team members is refused. Only an admin or the owner can do this. Invite can send an email through crea8.one. It does not change a social network. Remove drops a member from the workspace. Cancel revokes an invite. |
| workspaceProfileTool | Yes | false | false | false | Reads or updates the signed-in profile name, bio, and picture, or renames the workspace. Only the owner can rename. It does not change a password, log out, or delete an account. Writes only the profile and workspace name in crea8.one. Does not delete the account or the workspace. |
| emailNotificationsTool | Yes | false | false | false | Reads or updates the three email notification toggles. Writes only those toggles in crea8.one. Does not delete mail or the account. |
| webhooksTool | Yes | false | true | true | Lists, creates, updates, deletes, or sends a test webhook. Creating one past the plan limit is refused. The signing secret is not returned. Test sends a sample POST to the webhook URL. Delete removes the webhook. |
| approvedAppsTool | Yes | false | false | true | Lists OAuth apps this user approved, or revokes one. It does not create a client or return a secret. Writes only the approval row in crea8.one. Revoke invalidates that app's access for this user. |
| developerTool | Yes | true | false | false | Reads whether the plan includes the public API, whether an API key is stored, and the OAuth app's public fields. It does not return or rotate a key or secret. Reads crea8.one only. Does not delete or rotate credentials. |
| billingTool | Yes | false | true | false | Reads plan, status, renewal, credits, and usage, the same values as the billing screen. portal, checkout, and pack return a URL only when that call returns one. A workspace that already has a subscription is not changed. A workspace with no subscription cannot buy a credit pack. It does not cancel, refund, resume, or apply a coupon. portal, checkout, and pack can return a Dodo URL. overview stays inside crea8.one. Does not cancel, refund, or change an existing subscription. |
| generateVideoOptions | No | true | false | false | Lists video generators and their inputs. Reads crea8.one only. Does not start a job or spend a credit. |
| videoFunctionTool | No | true | false | false | Returns helper values for video generation, such as a voice id. Reads crea8.one only. Does not start a job or spend a credit. |
| generateVideoTool | No | false | true | false | Starts a video generation job, spends the video credit, and saves the file to the media library. Calls the generation provider and stores the file. Does not delete existing media or publish a post. |
| videoStatusTool | No | true | false | false | Reads the status of a video job and the hosted URL when it is done. Reads crea8.one only. Does not delete the job or the file. |
| clippingTool | No | false | true | false | Turns a public YouTube video into captioned vertical clips, spends clipping minutes, saves the clips, and can create draft posts. Nothing is published. Reads a public YouTube URL and calls the clipping providers. Does not delete existing media. Posts it creates are drafts. |
| clippingStatusTool | No | true | false | false | Reads a clipping job and the clip URLs when it is done. Reads crea8.one only. Does not delete the job or the clips. |
| clippingWidgetTicketTool | No | false | false | false | Creates a short-lived ticket so the clipping widget can read that job. The model does not use the ticket to change data. The ticket only reads that user's clipping job. Does not delete or publish. |
| generateImageTool | No | false | true | false | Generates an image, spends the image credit, and saves it to the media library. Calls the image provider and stores the file. Does not delete existing media or publish a post. |
| generatePostsTool | Yes | false | true | false | Turns one idea into a draft for every connected channel, the same generation as Schedule. format defaults to short. voice defaults to personal. It uses the same credit and plan check as the Schedule panel and does not add a charge. It does not schedule, publish, attach media, or generate an image. Calls the model to write the drafts. The drafts are returned to the client and are not saved as posts. Does not delete, schedule, or publish. |
| uploadFromUrlTool | Yes | false | true | false | Saves a public image or video URL into the media library. Fetches that URL and stores the file. Does not delete existing media or publish a post. |
| uploadWidgetTool | Yes | false | false | false | Opens the upload widget so the user can pick a file for the media library. The upload stays in this user's crea8.one media library. Does not delete existing media or publish a post. |
| uploadWidgetTicketTool | Yes | false | false | false | Creates a short-lived upload ticket for that widget. The ticket only allows an upload into this user's media library. Does not delete or publish. |
| uploadWidgetStatusTool | Yes | true | false | false | Lists files the widget uploaded. Reads crea8.one only. Does not delete or publish. |
| stalkerProjectsTool | Yes, when Stalker is enabled | false | true | true | Lists, creates, updates, deletes, or scans a Stalker project. Present only when STALKER_ENABLED=true. A workspace with no active plan, or one past a Stalker limit, is refused. Scan uses the same read credits as Check now. Scan reads the configured sources for that project. Delete removes the project. The client must confirm with the user before create, update, delete, or scan. |
| stalkerMentionsTool | Yes, when Stalker is enabled | false | false | true | Reads mentions or sets status, relevant or ignored, deletes a mention, or saves a view. It does not reply. Present only when STALKER_ENABLED=true. Reads and writes mention rows in crea8.one. It does not post a reply. Delete removes a mention. The client must confirm with the user before a change. |
| stalkerKeywordsTool | Yes, when Stalker is enabled | false | false | true | Lists, creates, updates, or deletes Stalker keywords and keyword groups. Present only when STALKER_ENABLED=true. Writes only those keyword rows. Delete removes a keyword or group. |
| stalkerAlertsTool | Yes, when Stalker is enabled | false | false | true | Lists alerts and rules, creates, updates, or deletes a rule, and marks an alert read. Present only when STALKER_ENABLED=true. Writes only alert rows in crea8.one. Delete removes a rule. |
| stalkerAnalyticsTool | Yes, when Stalker is enabled | true | false | false | Reads Stalker analytics for a project. It does not read provider insights. Present only when STALKER_ENABLED=true. Reads crea8.one only. Does not delete mentions, keywords, or projects. |
| linkPageTool | Yes | false | false | false | Reads the Link-in-Bio page or updates the fields you pass, including name, bio, slug, visibility, avatar, font, background, colours, Open Graph image, the sensitive-content flag, and the badge. A pro theme or badge removal on a free page is refused. Writes only that page in crea8.one. Does not delete the page. |
| linkBlocksTool | Yes | false | false | true | Creates, updates, deletes, or reorders Link-in-Bio blocks. Writes only those blocks. Delete removes a block. The client must confirm with the user before a change. |
| linkAnalyticsTool | Yes | true | false | false | Reads Link-in-Bio view and click analytics, or returns the CSV the screen downloads. A free page is refused the export. Reads crea8.one only. Does not delete analytics or the page. |
| linkLeadsTool | Yes | false | false | true | Reads Link-in-Bio leads, or deletes one lead. Only the workspace owner can delete a lead. The page is not deleted. Writes only that lead row. Delete removes one lead. The client must confirm with the user first. |
| linkDomainTool | Yes | false | true | true | Connects, checks, or removes the Link-in-Bio custom domain and returns the same status and DNS records as the settings screen. A page without the add-on is refused. Connect and check talk to the domain setup used by the settings screen. Remove disconnects the domain. The client must confirm with the user before connect or remove. |

## Privacy

`https://crea8.one/privacy`

Source: `apps/frontend/src/app/(legal)/privacy/page.tsx`. Confirm it answers on `https://crea8.one/privacy`.

The connector can read and write the signed-in organization's channels, posts, media library, Stalker data, Link-in-Bio page, analytics, leads, account profile, and billing. It does not receive social network passwords.

## Terms

`https://crea8.one/terms`

Source: `apps/frontend/src/app/(legal)/terms/page.tsx`.

## Support

`support@crea8.one`

## Logo

Square mark: `apps/frontend/public/crea8one-apple-touch-icon.png` (180×180 PNG). The wordmark `apps/frontend/public/crea8one-logo.png` is 877×263. If Claude asks for a larger square, export the same mark. Do not submit the wide wordmark as the icon.

## Auth

- Grant: authorization code with PKCE (`S256`). A PKCE grant returns a refresh token. `POST https://mcp.crea8.one/oauth/token` with `grant_type=refresh_token` rotates it. A reused, revoked, or foreign-client refresh token is rejected.
- Claude registers at `https://mcp.crea8.one/oauth/register`.
- Authorization URL: `https://app.crea8.one/oauth/authorize` (`FRONTEND_URL`).
- Token URL: `https://mcp.crea8.one/oauth/token`.
- Redirect URIs are the ones Claude sends at registration. Loopback and private-use schemes are accepted. If `DCR_VERIFIED_DOMAINS` is set, it must include `claude.ai` and `claude.com`. Leave it empty to accept any https callback.
- Scopes: `mcp:read` and `mcp:write`. Email claims are not granted to arbitrary dynamic clients.
- API key, not for this listing: `https://mcp.crea8.one/mcp` with `Authorization: Bearer <API key>`, or `https://mcp.crea8.one/mcp/<API key>`.

## Positive tests

1. List connected channels. Prompt: "Which social channels do I have connected in crea8.one? Show the platform and channel name for each one." Expected: `integrationList` lists platform and channel name. No post is created.
2. Generate drafts and do not schedule them. Prompt: "Turn this idea into a short company draft for every connected channel in crea8.one: the update is live. Do not schedule or publish it." Expected: `generatePostsTool` with format short and voice company returns one draft per channel. Nothing is scheduled or published. A plan or credit refusal is shown and no post is created.
3. Edit an existing post after the user confirms. Prompt: "Find my crea8.one draft that says the update is live and change the text to the update ships Friday. Keep it a draft. Do not publish it." Expected: `postsListTool`, then the client confirms with the user, then `update_post` with type update. The text changes. The post is not published again.
4. Delete a post only after the user confirms. Prompt: "Delete that crea8.one draft. Yes, delete it." Expected: the client confirms with the user first, then `delete_post` with `confirm` true. The post group is removed. A call without `confirm` true is refused and the post stays.
5. Read billing without changing the plan. Prompt: "What plan is my crea8.one workspace on, and how many credits are left? Do not change the plan or buy anything." Expected: `billingTool` action overview returns plan, status, renewal, credits, and usage. No checkout URL is opened.

## Negative tests

1. Do not delete a post the user has not confirmed. Prompt: "Delete my crea8.one draft that says the update is live. Wait, do not delete it." Expected: `delete_post` is not called. A call without `confirm` true is refused. The draft remains.
2. Do not use crea8.one for a calendar meeting. Prompt: "Move my team meeting from tomorrow to Friday afternoon." Expected: no crea8.one tool is called.
3. Do not schedule when the user only wants copy in the chat. Prompt: "Write three short posts about the update. Leave them in the chat. Do not save, schedule, or publish them in crea8.one." Expected: no crea8.one tool is called.

## Test account

Do not put a password in this file.

- Use a dedicated crea8.one user.
- Connect one channel the owner can post to during review.
- If Stalker tools should appear, set `STALKER_ENABLED=true` and add a project before the reviewer connects.
- Put one Link-in-Bio link on the page.
- Ask the reviewer to schedule, not publish immediately.
- Send the login only through the directory's private test-account fields.

## Host

`https://mcp.crea8.one` is a custom domain on the same API service as `https://api.crea8.one`. This change does not add DNS or a new deploy.
