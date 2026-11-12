# MCP

Public host: `https://mcp.crea8.one`. `https://api.crea8.one` is the same API process and keeps the same paths.

| Path | Client |
| --- | --- |
| `https://mcp.crea8.one/mcp` | API key as `Authorization: Bearer` |
| `https://mcp.crea8.one/mcp/<API key>` | API key in the URL |
| `https://mcp.crea8.one/mcp-oauth-dynamic` | Cursor and any client that registers at `/oauth/register`. Full tool list |
| `https://mcp.crea8.one/mcp-oauth-claude` | Claude connector directory. No image, video, or clipping tools |
| `https://mcp.crea8.one/mcp-oauth-chatgpt` | ChatGPT app. Pre-registered client, no dynamic registration |

OAuth is authorization code with PKCE (`S256`). A PKCE authorization-code grant returns a refresh token. `POST /oauth/token` with `grant_type=refresh_token` rotates it and keeps the same client and user. A reused token, a revoked grant, or a token from another client is rejected. An authorization-code grant without PKCE still returns an access token and no refresh token.

Issuer metadata:

- `https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-dynamic`
- `https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-chatgpt`

Both list `authorization_code` and `refresh_token`. `/mcp-oauth-claude` uses the dynamic issuer.

Registry name: `one.crea8/mcp`. Remote: `https://mcp.crea8.one/mcp-oauth-dynamic` (`streamable-http`). The file is `server.json` at the repository root.

Directory packs: `docs/submissions/chatgpt.md` and `docs/submissions/claude.md`.
