---
name: crea8one-agent
description: Schedule and manage social posts, Stalker mentions, and Link-in-Bio pages on crea8.one. Use when the user wants to list channels, create or schedule a post, upload media, read mentions, manage keywords or alerts, or edit a link-in-bio page from the terminal.
metadata:
  openclaw:
    requires:
      env:
        - CREA8_API_KEY
      bins:
        - crea8
---

# crea8one-agent

This skill drives the crea8.one public API with the `crea8` command. It reads `CREA8_API_KEY` from the environment, then `CRE8_API_KEY` if the new name is unset. Do not ask the user to paste the key into the chat if it is already in the environment. Do not print the key.

The command lives in this repository at `skills/crea8one-agent/bin/crea8.mjs`. Run it with Node 22:

```bash
export CREA8_API_KEY=your_api_key
node skills/crea8one-agent/bin/crea8.mjs integrations:list
```

Optional: `CRE8_API_URL` overrides the API origin. The default is `https://api.crea8.one`.

`npx skills add` installs this folder from the crea8 repository (`skills/crea8one-agent`). It does not need its own package registry. A separate public repo is only needed if an installer cannot point at a subdirectory of this repo.

Every command prints JSON. A non-zero exit means the API rejected the call; the body is on stderr.

## Commands

List channels and groups before posting. Call settings before a post that needs platform fields (a subreddit, a YouTube title, a board).

```bash
crea8 integrations:list
crea8 groups:list
crea8 integrations:settings <integration-id>
crea8 integrations:trigger <integration-id> <methodName> --data '{"subreddit":"programming"}'
```

Create a post only after the user confirms the text, channels, and time.

```bash
crea8 posts:create \
  --content "Hello" \
  --date "2026-10-14T09:00:00.000Z" \
  --integration "id-one,id-two"

crea8 posts:create --json campaign.json
crea8 posts:list
crea8 posts:delete <post-id>
crea8 posts:settings <post-id> --settings '{"title":"New title"}'
```

`--draft` saves a draft. `--now` publishes immediately. `--media https://...` uploads that URL and attaches it. `crea8 upload ./file.png` uploads a local file and prints `{ id, path }`.

```bash
crea8 analytics:platform <integration-id> --days 30
crea8 analytics:post <post-id> --days 7
```

Stalker (requires `STALKER_ENABLED` on the API):

```bash
crea8 stalker:projects
crea8 stalker:mentions --project <project-id> --date 7d
crea8 stalker:keywords --project <project-id>
crea8 stalker:keywords:add --project <project-id> --phrase "brand" --reddit
crea8 stalker:keywords:delete <keyword-id>
crea8 stalker:alerts --project <project-id>
crea8 stalker:rules --project <project-id>
crea8 stalker:rules:add --project <project-id> --name "Negatives" --filters '{"sentiment":"NEGATIVE"}'
crea8 stalker:rules:delete <rule-id>
crea8 stalker:alerts:read <alert-id>
```

Link-in-Bio:

```bash
crea8 link:get
crea8 link:update --json '{"name":"Studio","bio":"Links"}'
crea8 link:slug my-name
crea8 link:blocks:add --type LINK --title "Site" --url "https://example.com"
crea8 link:blocks:update <block-id> --json '{"title":"New title"}'
crea8 link:blocks:delete <block-id>
crea8 link:analytics --range 30d
crea8 link:leads
```

Confirm with the user before creating, updating, or deleting posts, keywords, alert rules, or link blocks. There is no MCP delete for posts; this CLI can delete a scheduled post when the user asks.
