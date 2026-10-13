# ChatGPT app directory — submission pack

Prepared only. Do not submit until the owner reviews the flagged URLs and the logo size.

## Name

crea8.one

## Description

Short: Schedule and publish social posts from ChatGPT across the channels connected in crea8.one.

Long: crea8.one connects ChatGPT to the social accounts already linked in a crea8.one organization. ChatGPT can list channels, schedule or publish posts, update settings on posts that have not gone out, upload media, generate images and videos, clip a long video, read Stalker mentions, manage Stalker keywords and alerts, and read or edit the Link-in-Bio page. The user signs in with OAuth. ChatGPT does not receive the social network passwords.

## MCP URL for the directory

`https://mcp.crea8.one/mcp-oauth-chatgpt`

This path uses a pre-registered OAuth client (no dynamic client registration) and the full tool list, including image generation, video generation, and clipping. The issuer metadata is `https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-chatgpt`.

Set `OPENAI_OAUTH_CLIENT_ID` to the ChatGPT app's client id before submission so that client can receive the email claim used for workspace domain checks.

## Tools

The directory listing uses the full tool set. Names below are the MCP tool ids.

| Tool | Description | In this listing |
| --- | --- | --- |
| integrationList | List connected channels. Optional group id filter. | Yes |
| groupList | List groups (customers). | Yes |
| integrationSchema | Posting rules, length limits, settings schema, and helper methods for one platform. | Yes |
| triggerTool | Call a platform helper from integrationSchema (channels, flairs, pages). | Yes |
| schedulePostTool | Schedule, draft, or publish a post. | Yes |
| postsListTool | List posts between two UTC dates, including settings. | Yes |
| postSettingsTool | Update provider settings on a scheduled post or draft that is not published yet. | Yes |
| uploadFromUrlTool | Save a public image or video URL into the media library. | Yes |
| uploadWidgetTool | Open the upload widget so the user can pick a file. | Yes |
| uploadWidgetTicketTool | Short-lived upload ticket for that widget. | Yes |
| uploadWidgetStatusTool | List files the widget uploaded. | Yes |
| generateImageTool | Generate an image for a post. | Yes |
| generateVideoOptions | List video generators and their inputs. | Yes |
| videoFunctionTool | Extra video settings such as a voice id. | Yes |
| generateVideoTool | Start video generation. | Yes |
| videoStatusTool | Check a video generation job. | Yes |
| clippingTool | Turn a long YouTube video into captioned vertical clips. | Yes |
| clippingStatusTool | Check a clipping job and return the clips. | Yes |
| clippingWidgetTicketTool | Short-lived ticket for the clipping progress widget. | Yes |
| stalkerProjectsTool | List Stalker projects. Present only when `STALKER_ENABLED=true`. | Yes, when enabled |
| stalkerMentionsTool | Read mentions for one Stalker project. | Yes, when enabled |
| stalkerKeywordsTool | List, create, update, or delete Stalker keywords. | Yes, when enabled |
| stalkerAlertsTool | List fired alerts, list or create or delete alert rules, mark an alert read. | Yes, when enabled |
| linkPageTool | Read the Link-in-Bio page or update its name, bio, slug, and visibility. | Yes |
| linkBlocksTool | Create, update, delete, or reorder Link-in-Bio blocks. | Yes |
| linkAnalyticsTool | Link-in-Bio view and click analytics. | Yes |
| linkLeadsTool | Link-in-Bio leads (email captures and contact form). | Yes |

There is no tool that deletes a post.

## Privacy

URL to enter: `https://crea8.one/privacy`

Check before submit: the privacy page in this repo is served by the Next.js app (`apps/frontend/src/app/(legal)/privacy/page.tsx`). Confirm it is reachable at `https://crea8.one/privacy` and not only at `https://app.crea8.one/privacy`.

What the connector accesses: the signed-in organization's channels, posts, media, Stalker projects and mentions, Link-in-Bio page, analytics, and leads. OAuth can include the account email when `OPENAI_OAUTH_CLIENT_ID` matches this client.

## Terms

URL to enter: `https://crea8.one/terms`

Check before submit: the terms page in this repo is `apps/frontend/src/app/(legal)/terms/page.tsx`. Confirm the public URL.

## Support

`support@crea8.one`

Check before submit: confirm that mailbox is monitored. The repo's security.txt default contact is the same address.

## Logo

ChatGPT app icons are square. Use `apps/frontend/public/crea8one-apple-touch-icon.png` (180×180 PNG). The horizontal wordmark `apps/frontend/public/crea8one-logo.png` is 877×263 and is the wrong shape.

Check before submit: 180×180 may be under the directory's minimum. If the form rejects it, export a larger square from the same mark. Do not crop the horizontal wordmark.

## Auth notes

- Grant: authorization code with PKCE (`S256`).
- Authorization URL: `{FRONTEND_URL}/oauth/authorize` (production: the crea8.one app origin, expected `https://app.crea8.one/oauth/authorize`).
- Token URL: `https://mcp.crea8.one/oauth/token`
- No registration endpoint on this path. Create the OAuth client in the ChatGPT submission and store its client id in `OPENAI_OAUTH_CLIENT_ID`.
- Redirect URI: whatever ChatGPT shows in the submission form. It must be saved on that OAuth app. This pack does not change production OAuth rows.
- Scopes: `openid`, `email`, `mcp:read`, `mcp:write` when the OpenAI client id is set. Otherwise `mcp:read` and `mcp:write`.
- API keys are not used for this directory listing. Custom connectors can still use `https://mcp.crea8.one/mcp` with `Authorization: Bearer <API key>`.

## Test account

Do not put a production password in this file.

- Create a crea8.one user that is not a customer account.
- Connect one low-risk channel (a test page or a personal profile the owner controls).
- Turn on Stalker if the listing should show those tools, and add one keyword that will not page real customers.
- Create a Link-in-Bio page with one public link.
- Schedule posts into the future during review. Do not leave "publish now" as the default test.
- Put the login email, password, and which channel is connected in the private submission form, not in git.

## DNS this listing depends on

`mcp.crea8.one` must resolve to the postiz-backend service before reviewers can open the OAuth metadata. See the pull request for the Spaceship CNAME.
