#!/usr/bin/env node

const api = (process.env.CRE8_API_URL || 'https://api.crea8.one').replace(/\/$/, '');
const key = process.env.CREA8_API_KEY || process.env.CRE8_API_KEY || '';

const usage = `crea8 — crea8.one agent CLI

Set CREA8_API_KEY (CRE8_API_KEY still works). Optional CRE8_API_URL (default https://api.crea8.one).

  crea8 integrations:list [--group id]
  crea8 groups:list
  crea8 integrations:settings <id>
  crea8 integrations:trigger <id> <method> [--data '{}']
  crea8 posts:list [--start ISO] [--end ISO] [--customer id]
  crea8 posts:create --content "text" --integration id[,id] [--date ISO] [--media url] [--settings '{}'] [--draft|--now] [--json file]
  crea8 posts:delete <id>
  crea8 posts:settings <id> --settings '{}'
  crea8 analytics:platform <id> [--days 30]
  crea8 analytics:post <postId> [--days 7]
  crea8 upload <file>
  crea8 upload-url <url>
  crea8 stalker:projects
  crea8 stalker:mentions --project id [--date 7d] [--q text]
  crea8 stalker:keywords --project id
  crea8 stalker:keywords:add --project id --phrase "text" [--reddit] [--x] [--linkedin]
  crea8 stalker:keywords:delete <id>
  crea8 stalker:alerts --project id
  crea8 stalker:rules --project id
  crea8 stalker:rules:add --project id --name "text" [--filters '{}']
  crea8 stalker:rules:delete <id>
  crea8 stalker:alerts:read <id>
  crea8 link:get
  crea8 link:update --json '{}'
  crea8 link:slug <slug>
  crea8 link:blocks:add --type LINK --title "text" --url "https://..."
  crea8 link:blocks:update <id> --json '{}'
  crea8 link:blocks:delete <id>
  crea8 link:blocks:reorder --ids id,id
  crea8 link:analytics [--range 30d]
  crea8 link:leads [--status CONFIRMED] [--q text]
`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!key) {
  fail('CREA8_API_KEY is not set');
}

const [command, ...rest] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') {
  console.log(usage.trim());
  process.exit(command ? 0 : 1);
}

const flags = {};
const positionals = [];
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (arg === '--draft' || arg === '--now' || arg === '--reddit' || arg === '--x' || arg === '--linkedin') {
    flags[arg.slice(2)] = true;
    continue;
  }
  if (arg.startsWith('--')) {
    const name = arg.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[name] = true;
    } else {
      flags[name] = next;
      i += 1;
    }
    continue;
  }
  positionals.push(arg);
}

const request = async (path, options = {}) => {
  const headers = { Authorization: key, ...(options.headers || {}) };
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    console.error(JSON.stringify({ status: response.status, body }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
};

const readJson = async (value) => {
  if (!value) return {};
  if (value.endsWith('.json')) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(value, 'utf8'));
  }
  return JSON.parse(value);
};

const query = (params) => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(name, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

const isoDays = (days) => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
};

const run = async () => {
  switch (command) {
    case 'integrations:list':
      return request(`/public/v1/integrations${query({ group: flags.group })}`);
    case 'groups:list':
      return request('/public/v1/groups');
    case 'integrations:settings':
      return request(`/public/v1/integration-settings/${positionals[0] || fail('integration id required')}`);
    case 'integrations:trigger': {
      const id = positionals[0] || fail('integration id required');
      const methodName = positionals[1] || fail('method name required');
      return request(`/public/v1/integration-trigger/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodName,
          data: flags.data ? await readJson(flags.data) : {},
        }),
      });
    }
    case 'posts:list': {
      const window = isoDays(365);
      return request(
        `/public/v1/posts${query({
          startDate: flags.start || window.start,
          endDate: flags.end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          customer: flags.customer,
        })}`
      );
    }
    case 'posts:create': {
      const payload = flags.json ? await readJson(flags.json) : null;
      if (payload) {
        payload.creationMethod = 'CLI';
        return request('/public/v1/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const content = flags.content || fail('--content or --json is required');
      const integration = flags.integration || fail('--integration is required');
      let image = [];
      if (flags.media) {
        const uploaded = await fetch(`${api}/public/v1/upload-from-url`, {
          method: 'POST',
          headers: { Authorization: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: flags.media }),
        });
        const media = await uploaded.json();
        if (!uploaded.ok) {
          fail(JSON.stringify(media));
        }
        image = [media];
      }
      const settings = flags.settings ? await readJson(flags.settings) : {};
      const type = flags.draft ? 'draft' : flags.now ? 'now' : 'schedule';
      return request('/public/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date: flags.date || new Date().toISOString(),
          shortLink: false,
          tags: [],
          creationMethod: 'CLI',
          posts: String(integration)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .map((id) => ({
              integration: { id },
              value: [{ content, image }],
              settings,
            })),
        }),
      });
    }
    case 'posts:delete':
      return request(`/public/v1/posts/${positionals[0] || fail('post id required')}`, { method: 'DELETE' });
    case 'posts:settings':
      return request(`/public/v1/posts/${positionals[0] || fail('post id required')}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: await readJson(flags.settings || fail('--settings is required')),
        }),
      });
    case 'analytics:platform':
      return request(
        `/public/v1/analytics/${positionals[0] || fail('integration id required')}${query({ date: flags.days || 30 })}`
      );
    case 'analytics:post':
      return request(
        `/public/v1/analytics/post/${positionals[0] || fail('post id required')}${query({ date: flags.days || 7 })}`
      );
    case 'upload': {
      const file = positionals[0] || fail('file path required');
      const { readFile } = await import('node:fs/promises');
      const { basename } = await import('node:path');
      const bytes = await readFile(file);
      const body = new FormData();
      body.append('file', new Blob([bytes]), basename(file));
      return request('/public/v1/upload', { method: 'POST', body });
    }
    case 'upload-url':
      return request('/public/v1/upload-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: positionals[0] || fail('url required') }),
      });
    case 'stalker:projects':
      return request('/public/v1/stalker/projects');
    case 'stalker:mentions':
      return request(
        `/public/v1/stalker/mentions${query({
          projectId: flags.project || fail('--project is required'),
          date: flags.date,
          q: flags.q,
          source: flags.source,
          status: flags.status,
        })}`
      );
    case 'stalker:keywords':
      return request(`/public/v1/stalker/keywords${query({ projectId: flags.project || fail('--project is required') })}`);
    case 'stalker:keywords:add':
      return request('/public/v1/stalker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: flags.project || fail('--project is required'),
          phrase: flags.phrase || fail('--phrase is required'),
          reddit: !!flags.reddit,
          x: !!flags.x,
          linkedin: !!flags.linkedin,
        }),
      });
    case 'stalker:keywords:delete':
      return request(`/public/v1/stalker/keywords/${positionals[0] || fail('keyword id required')}`, {
        method: 'DELETE',
      });
    case 'stalker:alerts':
      return request(`/public/v1/stalker/alerts${query({ projectId: flags.project || fail('--project is required') })}`);
    case 'stalker:rules':
      return request(`/public/v1/stalker/rules${query({ projectId: flags.project || fail('--project is required') })}`);
    case 'stalker:rules:add':
      return request('/public/v1/stalker/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: flags.project || fail('--project is required'),
          name: flags.name || fail('--name is required'),
          filters: flags.filters ? await readJson(flags.filters) : {},
        }),
      });
    case 'stalker:rules:delete':
      return request(`/public/v1/stalker/rules/${positionals[0] || fail('rule id required')}`, { method: 'DELETE' });
    case 'stalker:alerts:read':
      return request(`/public/v1/stalker/alerts/${positionals[0] || fail('alert id required')}/read`, {
        method: 'POST',
      });
    case 'link:get':
      return request('/public/v1/link');
    case 'link:update':
      return request('/public/v1/link', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await readJson(flags.json || fail('--json is required'))),
      });
    case 'link:slug':
      return request('/public/v1/link/slug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: positionals[0] || fail('slug required') }),
      });
    case 'link:blocks:add':
      return request('/public/v1/link/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: flags.type || 'LINK',
          title: flags.title,
          url: flags.url,
          body: flags.body,
        }),
      });
    case 'link:blocks:update':
      return request(`/public/v1/link/blocks/${positionals[0] || fail('block id required')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await readJson(flags.json || fail('--json is required'))),
      });
    case 'link:blocks:delete':
      return request(`/public/v1/link/blocks/${positionals[0] || fail('block id required')}`, {
        method: 'DELETE',
      });
    case 'link:blocks:reorder':
      return request('/public/v1/link/blocks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: String(flags.ids || fail('--ids is required'))
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        }),
      });
    case 'link:analytics':
      return request(`/public/v1/link/analytics${query({ range: flags.range || '30d', from: flags.from, to: flags.to })}`);
    case 'link:leads':
      return request(`/public/v1/link/leads${query({ status: flags.status, q: flags.q })}`);
    default:
      fail(`Unknown command: ${command}\n\n${usage}`);
  }
};

run().catch((err) => fail(err instanceof Error ? err.message : String(err)));
