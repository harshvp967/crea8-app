# Claude connector directory — submission pack

Prepared only. Do not submit until the owner reviews the flagged URLs and the logo size.

## Name

crea8.one

## Description

Short: Schedule social posts from Claude on the channels connected in crea8.one.

Long: crea8.one lets Claude list connected channels, schedule or publish posts, update settings on posts that have not gone out, upload media from a URL, read Stalker mentions, manage Stalker keywords and alerts, and read or edit a Link-in-Bio page. The directory connector omits image generation, video generation, and clipping. Those stay available on the custom MCP link. The user signs in with OAuth.

## MCP URL for the directory

`https://mcp.crea8.one/mcp-oauth-claude`

This path uses dynamic client registration and the Claude-safe tool list. Issuer metadata: `https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-claude`. Protected resource metadata: `https://mcp.crea8.one/.well-known/oauth-protected-resource/mcp-oauth-claude`. The same documents are served on `api.crea8.one` with that host in the issuer, token, and registration URLs.

Custom connector for the full tool list, including media generation and clipping: `https://mcp.crea8.one/mcp-oauth-dynamic`.

## Tools

Hidden on `/mcp-oauth-claude` because the directory does not accept media-generation tools:

- generateImageTool
- generateVideoOptions
- videoFunctionTool
- generateVideoTool
- videoStatusTool
- clippingTool
- clippingStatusTool
- clippingWidgetTicketTool

The clipping widget resource is hidden with those tools. The upload widget stays.

| Tool | Description | Directory connector |
| --- | --- | --- |
| integrationList | List connected channels. Optional group id filter. | Yes |
| groupList | List groups (customers). | Yes |
| integrationSchema | Posting rules, length limits, settings schema, and helper methods for one platform. | Yes |
| triggerTool | Call a platform helper from integrationSchema. | Yes |
| schedulePostTool | Schedule, draft, or publish a post. | Yes |
| postsListTool | List posts between two UTC dates, including settings. | Yes |
| postSettingsTool | Update provider settings on a scheduled post or draft that is not published yet. | Yes |
| uploadFromUrlTool | Save a public image or video URL into the media library. | Yes |
| uploadWidgetTool | Open the upload widget so the user can pick a file. | Yes |
| uploadWidgetTicketTool | Short-lived upload ticket for that widget. | Yes |
| uploadWidgetStatusTool | List files the widget uploaded. | Yes |
| generateImageTool | Generate an image for a post. | No |
| generateVideoOptions | List video generators and their inputs. | No |
| videoFunctionTool | Extra video settings such as a voice id. | No |
| generateVideoTool | Start video generation. | No |
| videoStatusTool | Check a video generation job. | No |
| clippingTool | Turn a long YouTube video into captioned vertical clips. | No |
| clippingStatusTool | Check a clipping job and return the clips. | No |
| clippingWidgetTicketTool | Short-lived ticket for the clipping progress widget. | No |
| stalkerProjectsTool | List Stalker projects. Present only when `STALKER_ENABLED=true`. | Yes, when enabled |
| stalkerMentionsTool | Read mentions for one Stalker project. | Yes, when enabled |
| stalkerKeywordsTool | List, create, update, or delete Stalker keywords. | Yes, when enabled |
| stalkerAlertsTool | List fired alerts, list or create or delete alert rules, mark an alert read. | Yes, when enabled |
| linkPageTool | Read the Link-in-Bio page or update its name, bio, slug, and visibility. | Yes |
| linkBlocksTool | Create, update, delete, or reorder Link-in-Bio blocks. | Yes |
| linkAnalyticsTool | Link-in-Bio view and click analytics. | Yes |
| linkLeadsTool | Link-in-Bio leads. | Yes |

There is no tool that deletes a post.

## Privacy

URL to enter: `https://crea8.one/privacy`

Check before submit: the page source is `apps/frontend/src/app/(legal)/privacy/page.tsx`. Confirm it answers on `https://crea8.one/privacy` and not only on `https://app.crea8.one/privacy`.

The connector can read and write the signed-in organization's channels, posts, media library, Stalker data, and Link-in-Bio page, analytics, and leads. It does not receive social network passwords.

## Terms

URL to enter: `https://crea8.one/terms`

Check before submit: source is `apps/frontend/src/app/(legal)/terms/page.tsx`. Confirm the public URL.

## Support

`support@crea8.one`

Check before submit: confirm the mailbox is monitored.

## Logo

Use the square mark `apps/frontend/public/crea8one-apple-touch-icon.png` (180×180 PNG). The wordmark `apps/frontend/public/crea8one-logo.png` is 877×263.

Check before submit: if Claude asks for a larger square (often 512×512 or 1024×1024), export the same mark at that size. Do not submit the wide wordmark as the icon.

## Auth notes

- Grant: authorization code with PKCE (`S256`).
- Claude registers itself at `https://mcp.crea8.one/oauth/register`.
- Authorization URL: `{FRONTEND_URL}/oauth/authorize`.
- Token URL: `https://mcp.crea8.one/oauth/token`.
- Redirect URIs are the ones Claude sends at registration. Loopback and private-use schemes are accepted. If `DCR_VERIFIED_DOMAINS` is set in production, it must include `claude.ai` and `claude.com` or registration fails. Leave it empty to accept any https callback.
- Scopes on this connector: `mcp:read` and `mcp:write`. Email claims are not granted to arbitrary dynamic clients.
- API-key alternative, not for the directory listing: `https://mcp.crea8.one/mcp` with `Authorization: Bearer <API key>`, or `https://mcp.crea8.one/mcp/<API key>`.

## Test account

Do not put a production password in this file.

- Use a dedicated crea8.one user.
- Connect one channel the owner can afford to post to during review.
- If Stalker tools should appear, set `STALKER_ENABLED=true` and add a project before the reviewer connects.
- Put one Link-in-Bio link on the page so read and edit can be tried.
- Ask the reviewer to schedule, not publish immediately.
- Send the login only through the directory's private test-account fields.

## DNS this listing depends on

`mcp.crea8.one` must be the Railway custom domain on the postiz-backend service. The pull request states the Spaceship record.
