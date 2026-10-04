# LinkedIn

Crea8one uses two LinkedIn apps. Community Management API has to be the only product on an app, so personal posting and company pages cannot share one client.

## Personal (`linkedin`)

App products: Share on LinkedIn, and Sign In with LinkedIn using OpenID Connect.

Environment:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

Redirect URL (exact, no query string): `{FRONTEND_URL}/integrations/social/linkedin`

Scopes: `openid profile email w_member_social`

Identity comes from `GET https://api.linkedin.com/v2/userinfo` (`sub`, `name`, `picture`, `email`). Posts are authored as `urn:li:person:{sub}`.

These apps do not return a refresh token. The access token lasts 60 days (`expires_in`). When it is about to expire, the channel is marked for reconnect instead of calling LinkedIn with an empty refresh token.

## Pages (`linkedin-page`)

App product: Community Management API only.

Environment:

- `LINKEDIN_PAGES_CLIENT_ID`
- `LINKEDIN_PAGES_CLIENT_SECRET`

If those are unset, token refresh falls back to `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`. Starting a new Page connection does not: the personal app cannot grant organization scopes, and LinkedIn would show its own error page. The calendar shows `LinkedIn Pages isn't available yet` instead.

A self-hosted install whose only LinkedIn app already has Community Management should set `LINKEDIN_PAGES_CLIENT_ID` and `LINKEDIN_PAGES_CLIENT_SECRET` to that app (they can match `LINKEDIN_CLIENT_*`).

Redirect URL (exact, no query string): `{FRONTEND_URL}/integrations/social/linkedin-page`

Scopes, from the Community Management permission list: `r_basicprofile rw_organization_admin w_organization_social r_organization_social`

`r_basicprofile` is the profile scope that product grants. OpenID scopes (`openid`, `profile`, `email`) belong to the other app and are not requested here. The member id comes from `GET https://api.linkedin.com/v2/me`.

## Railway

On the backend service set `LINKEDIN_PAGES_CLIENT_ID` and `LINKEDIN_PAGES_CLIENT_SECRET` from the Pages app. `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` stay the personal app. Register the Pages redirect on the Pages app's Auth tab. No new variable is required for personal LinkedIn.
