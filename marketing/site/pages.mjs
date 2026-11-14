export const channels = [
  { name: 'X', icon: 'x.png' },
  { name: 'LinkedIn', icon: 'linkedin.png' },
  { name: 'LinkedIn Page', icon: 'linkedin-page.png' },
  { name: 'Reddit', icon: 'reddit.png' },
  { name: 'Instagram (Facebook Business)', icon: 'instagram.png' },
  { name: 'Instagram (Standalone)', icon: 'instagram-standalone.png' },
  { name: 'Facebook Page', icon: 'facebook.png' },
  { name: 'Threads', icon: 'threads.png' },
  { name: 'YouTube', icon: 'youtube.png' },
  { name: 'Tiktok', icon: 'tiktok.png' },
  { name: 'Pinterest', icon: 'pinterest.png' },
  { name: 'Dribbble', icon: 'dribbble.png' },
  { name: 'Discord', icon: 'discord.png' },
  { name: 'Slack', icon: 'slack.png' },
  { name: 'Kick', icon: 'kick.png' },
  { name: 'Twitch', icon: 'twitch.png' },
  { name: 'Mastodon', icon: 'mastodon.png' },
  { name: 'Bluesky', icon: 'bluesky.png' },
  { name: 'Lemmy', icon: 'lemmy.png' },
  { name: 'Farcaster', icon: 'wrapcast.png' },
  { name: 'Telegram', icon: 'telegram.png' },
  { name: 'Nostr', icon: 'nostr.png' },
  { name: 'Dev.to', icon: 'devto.png' },
  { name: 'Hashnode', icon: 'hashnode.png' },
  { name: 'WordPress', icon: 'wordpress.png' },
  { name: 'ListMonk', icon: 'listmonk.png' },
  { name: 'Moltbook', icon: 'moltbook.png' },
  { name: 'Skool', icon: 'skool.png' },
  { name: 'Tumblr', icon: 'tumblr.png' },
];

export const comingSoon = [
  { name: 'Medium', icon: 'medium.png' },
  { name: 'Whop', icon: 'whop.png' },
  { name: 'MeWe', icon: 'mewe.png' },
  { name: 'TikTok Business', icon: 'tiktok-business.png' },
  { name: 'VK', icon: 'vk.png' },
  { name: 'Google My Business', icon: 'gmb.png' },
];

const plans = [
  {
    name: 'Creator',
    month: '$19 a month',
    year: '$190 a year',
    lines: [
      '5 channels',
      '1 team member',
      'Unlimited workspaces',
      '300 credits refill monthly',
      '3 Stalker keywords',
      'Stalker scan every 12 hours',
      '3 Stalker checks a day',
      '30 days of mentions',
      '2 webhooks',
      'Unlimited posts a month',
      'AI post',
      'Posting sets',
      'Analytics',
      'Link in Bio, all themes',
      'Badge removed',
    ],
  },
  {
    name: 'Team',
    month: '$39 a month',
    year: '$390 a year',
    lines: [
      '10 channels',
      'Unlimited team members',
      'Unlimited workspaces',
      '700 credits refill monthly',
      '10 Stalker keywords',
      'Stalker scan every 6 hours',
      '10 Stalker checks a day',
      '90 days of mentions',
      '10 webhooks',
      'Unlimited posts a month',
      'AI post',
      'Posting sets',
      'Analytics',
      'Link in Bio, all themes',
      'Badge removed',
    ],
  },
  {
    name: 'Pro',
    month: '$59 a month',
    year: '$590 a year',
    lines: [
      '30 channels',
      'Unlimited team members',
      'Unlimited workspaces',
      '1,100 credits refill monthly',
      '25 Stalker keywords',
      'Stalker scan every 2 hours',
      '30 Stalker checks a day',
      '365 days of mentions',
      '30 webhooks',
      'Unlimited posts a month',
      'AI post',
      'Posting sets',
      'Analytics',
      'Link in Bio, all themes',
      'Badge removed',
    ],
  },
  {
    name: 'Agency',
    month: '$99 a month',
    year: '$990 a year',
    lines: [
      '100 channels',
      'Unlimited team members',
      'Unlimited workspaces',
      '1,800 credits refill monthly',
      '75 Stalker keywords',
      'Stalker scan every 1 hour',
      'Unlimited Stalker checks a day',
      '365 days of mentions',
      '10,000 webhooks',
      'Unlimited posts a month',
      'AI post',
      'Posting sets',
      'Analytics',
      'Link in Bio, all themes',
      'Badge removed',
    ],
  },
];

function esc(text) {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

function pre(text) {
  return `<pre class="snippet">${esc(text)}</pre>`;
}

function card(title, inner, href) {
  const body = `<h3>${esc(title)}</h3>${inner}`;
  if (href) {
    return `<a class="card" href="${href}">${body}</a>`;
  }
  return `<article class="card">${body}</article>`;
}

function lines(items) {
  return `<ul class="lines">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function logos(items, soon) {
  return `<div class="logos">${items
    .map(
      (item) => `<div class="logo-tile">
        <img src="/icons/${item.icon}" alt="">
        <span>${esc(item.name)}</span>
        ${soon ? '<span class="soon">Coming soon</span>' : ''}
      </div>`
    )
    .join('')}</div>`;
}

function faq(items) {
  return `<div class="faq">${items
    .map(
      ([question, answer]) => `<details>
        <summary>${esc(question)}</summary>
        <p>${answer}</p>
      </details>`
    )
    .join('')}</div>`;
}

const cursorOauth = JSON.stringify(
  { mcpServers: { crea8one: { url: 'https://mcp.crea8.one/mcp-oauth-dynamic' } } },
  null,
  2
);

const cursorKey = JSON.stringify(
  {
    mcpServers: {
      crea8one: {
        url: 'https://mcp.crea8.one/mcp',
        headers: { Authorization: 'Bearer <API key>' },
      },
    },
  },
  null,
  2
);

const home = `
  <section class="hero">
    <h1>crea8.one</h1>
    <div class="actions">
      <a class="btn btn-primary" href="/agent">Agent</a>
      <a class="btn btn-secondary" href="/schedule">Schedule</a>
    </div>
  </section>
  <section class="stack">
    <h2>Who it's for</h2>
    <div class="grid-3">
      ${card('AI-first marketers', '')}
      ${card('Developers', '')}
      ${card('Automation teams', '')}
    </div>
  </section>
  <section class="stack">
    <h2>Agent</h2>
    <div class="grid">
      ${card('MCP', '', '/mcp')}
      ${card('ChatGPT', '', '/chatgpt')}
      ${card('Claude', '', '/claude')}
      ${card('Claude Code', '', '/claude-code')}
      ${card('Cursor', '', '/cursor')}
      ${card('Grok Bot', '', '/grok-bot')}
      ${card('CLI', '', '/cli')}
    </div>
  </section>
  <section class="stack">
    <h2>Features</h2>
    <div class="grid">
      ${card('Schedule', '', '/schedule')}
      ${card('Link in Bio', '', '/link')}
      ${card('Stalker', '', '/stalker')}
      ${card('Channels', '', '/channels')}
      ${card('MCP', '', '/mcp')}
      ${card('CLI', '', '/cli')}
    </div>
    ${logos(channels, false)}
  </section>
  <section class="mid">
    <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
  </section>
  <section class="stack">
    <h2>FAQ</h2>
    ${faq([
      [
        'What does the trial cost?',
        'The 7-day trial checks out at $0 and includes 50 credits. You are not charged today. GST is added at checkout.',
      ],
      [
        'What are the prices?',
        'Creator is $19 a month or $190 a year. Team is $39 a month or $390 a year. Pro is $59 a month or $590 a year. Agency is $99 a month or $990 a year. Prices are USD.',
      ],
      [
        'Where is MCP?',
        'https://mcp.crea8.one/mcp takes an API key as Authorization: Bearer. https://mcp.crea8.one/mcp-oauth-dynamic is the OAuth URL for a client that registers itself.',
      ],
      [
        'Where do I sign in?',
        'Start at https://app.crea8.one/register. Log in at https://app.crea8.one/login.',
      ],
    ])}
  </section>
`;

const schedule = `
  <section class="stack">
    <h1>Schedule</h1>
    <p class="fact">Schedule stays closed until a plan or the trial exists.</p>
    <div class="grid">
      ${card('Post', lines(['Text', 'Channels', 'Time']))}
      ${card('Draft', lines(['--draft saves a draft']))}
      ${card('Publish now', lines(['--now publishes immediately']))}
      ${card('Media', lines(['--media https://... uploads that URL and attaches it', 'crea8 upload ./file.png uploads a local file and prints id and path']))}
      ${card('Posts', lines(['posts:list', 'posts:delete', 'posts:settings']))}
      ${card('Analytics', lines(['analytics:platform', 'analytics:post']))}
    </div>
    <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
  </section>
`;

const link = `
  <section class="stack">
    <h1>Link in Bio</h1>
    <p class="fact">Link in Bio stays open without a plan or trial.</p>
    <p class="fact">The public URL is https://crea8.one/@username. A live custom domain replaces that URL.</p>
    <div class="grid">
      ${card(
        'Blocks',
        lines([
          'Link',
          'Featured post',
          'Email capture',
          'Heading',
          'Embed',
          'Text',
          'FAQ',
          'Image carousel',
          'Contact form',
          'Map',
          'Calendly',
          'Contact details',
          'Discount',
          'Events',
          'Music',
          'Latest YouTube',
        ])
      )}
      ${card(
        'Themes',
        lines(['Midnight', 'Paper', 'Sand', 'Ocean', 'Bloom', 'Aurora', 'Noir', 'Forest', 'Sunset'])
      )}
      ${card('Layouts', lines(['Classic', 'Featured', 'Card', 'Tile']))}
      ${card('Buttons', lines(['Pill', 'Rounded', 'Square']))}
      ${card('Fonts', lines(['Plus Jakarta Sans', 'Georgia', 'Palatino', 'Trebuchet MS', 'Courier New']))}
      ${card(
        'Socials',
        lines([
          'Instagram',
          'X',
          'YouTube',
          'LinkedIn',
          'TikTok',
          'Threads',
          'Facebook',
          'Bluesky',
          'Twitch',
          'Pinterest',
          'Reddit',
          'Website',
        ])
      )}
    </div>
    <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
  </section>
`;

const stalker = `
  <section class="stack">
    <h1>Stalker</h1>
    <p class="fact">Stalker stays closed until a plan or the trial exists.</p>
    <p class="fact">Stalker commands on the API require STALKER_ENABLED to be the string true.</p>
    <div class="grid">
      ${card('Search', lines(['X', 'Reddit', 'YouTube']))}
      ${card('LinkedIn', '<p class="soon">Coming soon</p>')}
      ${card('Comments', lines(['YouTube', 'Instagram', 'Facebook']))}
      ${card('Reply', lines(['YouTube', 'Facebook', 'Instagram', 'X']))}
      ${card('Screens', lines(['Mentions', 'Analytics', 'Themes', 'Keywords', 'Alerts', 'Settings']))}
    </div>
    <p class="fact">A reply is reviewed before it is sent. Nothing is sent or scheduled automatically.</p>
    <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
  </section>
`;

const channelPage = `
  <section class="stack">
    <h1>Channels</h1>
    ${logos(channels, false)}
    <h2>Coming soon</h2>
    ${logos(comingSoon, true)}
  </section>
`;

const pricing = `
  <section class="stack">
    <h1>Pricing</h1>
    <p class="fact">USD. GST is added at checkout.</p>
    <div class="grid">
      ${card('7-day trial', `${lines(['$0', '50 credits'])}`)}
      ${card('150 credits', '<p class="price">$5</p>')}
      ${card('500 credits', '<p class="price">$15</p>')}
      ${plans
        .map(
          (plan) =>
            card(
              plan.name,
              `<p class="price">${esc(plan.month)}</p><p class="price">${esc(plan.year)}</p>${lines(plan.lines)}`
            )
        )
        .join('')}
    </div>
    ${faq([
      [
        'When is the trial charged?',
        'You are not charged today. The 7-day trial checks out at $0. GST is added at checkout. Dodo Payments is the merchant of record. You can pay by card or UPI where Dodo offers it, and cancel anytime from billing. Email support@crea8.one if you need help.',
      ],
      [
        'When do plan credits start?',
        'The trial includes 50 credits. The plan monthly credits apply on the first successful charge.',
      ],
    ])}
    <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
  </section>
`;

const agent = `
  <section class="stack">
    <h1>Agent</h1>
    <div class="grid">
      ${card('MCP', '', '/mcp')}
      ${card('ChatGPT', '', '/chatgpt')}
      ${card('Claude', '', '/claude')}
      ${card('Claude Code', '', '/claude-code')}
      ${card('Cursor', '', '/cursor')}
      ${card('Grok Bot', '', '/grok-bot')}
      ${card('CLI', '', '/cli')}
    </div>
  </section>
`;

const mcp = `
  <section class="stack">
    <h1>MCP</h1>
    <p class="fact">https://api.crea8.one is the same API and keeps the same paths.</p>
    <div class="grid">
      ${card('API key', pre('https://mcp.crea8.one/mcp\nAuthorization: Bearer <API key>'))}
      ${card('Key in the URL', pre('https://mcp.crea8.one/mcp/<API key>'))}
      ${card('OAuth', pre('https://mcp.crea8.one/mcp-oauth-dynamic'))}
      ${card('ChatGPT', pre('https://mcp.crea8.one/mcp-oauth-chatgpt'))}
      ${card('Claude', pre('https://mcp.crea8.one/mcp-oauth-claude'))}
    </div>
    <p class="fact">OAuth is authorization code with PKCE (S256).</p>
    ${card(
      'Issuer metadata',
      lines([
        'https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-dynamic',
        'https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-chatgpt',
      ])
    )}
    <p class="fact">Both list authorization_code and refresh_token. /mcp-oauth-claude uses the dynamic issuer.</p>
  </section>
`;

const chatgpt = `
  <section class="stack">
    <h1>ChatGPT</h1>
    ${card(
      'Custom connector',
      `<p class="fact">${esc('In ChatGPT go to Settings > Connectors > Create and paste this URL.')}</p>${pre(
        'https://mcp.crea8.one/mcp-oauth-dynamic'
      )}${pre('https://mcp.crea8.one/mcp-oauth-chatgpt')}`
    )}
    ${card('API key', pre('https://mcp.crea8.one/mcp/<API key>'))}
  </section>
`;

const claude = `
  <section class="stack">
    <h1>Claude</h1>
    ${card(
      'Custom connector',
      `<p class="fact">${esc('In Claude go to Settings > Connectors > Add custom connector and paste this URL.')}</p>${pre(
        'https://mcp.crea8.one/mcp-oauth-dynamic'
      )}${pre('https://mcp.crea8.one/mcp-oauth-claude')}`
    )}
    ${card('API key', pre('https://mcp.crea8.one/mcp/<API key>'))}
  </section>
`;

const claudeCode = `
  <section class="stack">
    <h1>Claude Code</h1>
    <p class="fact">Run this command in your terminal.</p>
    ${card(
      'OAuth',
      pre('claude mcp add crea8one --transport http "https://mcp.crea8.one/mcp-oauth-dynamic"')
    )}
    ${card(
      'API key',
      pre(
        'claude mcp add --transport http crea8one https://mcp.crea8.one/mcp --header "Authorization: Bearer <API key>"'
      )
    )}
  </section>
`;

const cursor = `
  <section class="stack">
    <h1>Cursor</h1>
    <p class="fact">Add to .cursor/mcp.json in your project root.</p>
    ${card('OAuth', pre(cursorOauth))}
    ${card('API key', pre(cursorKey))}
  </section>
`;

const grok = `
  <section class="stack">
    <h1>Grok Bot</h1>
    ${card(
      'Chat',
      `<p class="fact">Paste this into the chat. The agent will ask you for your API key.</p>${pre(
        'Ask me for my crea8.one API key and send requests to the crea8.one API with it as the Authorization header.'
      )}${pre('https://api.crea8.one\nAuthorization: Bearer <API key>')}`
    )}
  </section>
`;

const cli = `
  <section class="stack">
    <h1>CLI</h1>
    <p class="fact">The command is crea8. It reads CREA8_API_KEY. CRE8_API_KEY still works and is deprecated. CRE8_API_URL overrides the API origin. The default origin is https://api.crea8.one.</p>
    <p class="fact">Run it with Node 22 from skills/crea8one-agent/bin/crea8.mjs. npx skills add installs that folder from this repository.</p>
    ${card(
      'Key',
      pre('export CREA8_API_KEY=your_api_key\nnode skills/crea8one-agent/bin/crea8.mjs integrations:list')
    )}
    ${card(
      'Posts',
      pre(`crea8 integrations:list
crea8 groups:list
crea8 integrations:settings <integration-id>
crea8 posts:create --content "Hello" --date "2026-10-14T09:00:00.000Z" --integration "id-one,id-two"
crea8 posts:create --json campaign.json
crea8 posts:list
crea8 posts:delete <post-id>
crea8 posts:settings <post-id> --settings '{"title":"New title"}'`)
    )}
    ${card('Draft, now, media', pre('crea8 posts:create --draft\ncrea8 posts:create --now\ncrea8 posts:create --media https://...\ncrea8 upload ./file.png'))}
    ${card(
      'Analytics',
      pre('crea8 analytics:platform <integration-id> --days 30\ncrea8 analytics:post <post-id> --days 7')
    )}
    ${card(
      'Stalker',
      pre(`crea8 stalker:projects
crea8 stalker:mentions --project <project-id> --date 7d
crea8 stalker:keywords --project <project-id>
crea8 stalker:keywords:add --project <project-id> --phrase "brand" --reddit
crea8 stalker:keywords:delete <keyword-id>
crea8 stalker:alerts --project <project-id>`)
    )}
    <p class="fact">Stalker commands require STALKER_ENABLED on the API.</p>
    ${card(
      'Link in Bio',
      pre(`crea8 link:get
crea8 link:update --json '{"name":"Studio","bio":"Links"}'
crea8 link:slug my-name
crea8 link:blocks:add --type LINK --title "Site" --url "https://example.com"
crea8 link:analytics --range 30d
crea8 link:leads`)
    )}
    <p class="fact">Every command prints JSON. A non-zero exit means the API rejected the call. The body is on stderr.</p>
  </section>
`;

const about = `
  <section class="stack">
    <h1>About</h1>
    <div class="grid">
      ${card('Schedule', '', '/schedule')}
      ${card('Link in Bio', '', '/link')}
      ${card('Stalker', '', '/stalker')}
      ${card('MCP', '', '/mcp')}
      ${card('CLI', '', '/cli')}
    </div>
    <p class="fact"><a href="mailto:support@crea8.one">support@crea8.one</a></p>
  </section>
`;

const contact = `
  <section class="stack">
    <h1>Contact</h1>
    <p class="fact"><a href="mailto:support@crea8.one">support@crea8.one</a></p>
    <p class="fact">Email support@crea8.one if you need help.</p>
  </section>
`;

const missing = `
  <section class="not-found">
    <div>
      <p>404</p>
      <h1>This page could not be found.</h1>
      <a href="/">Back to home</a>
    </div>
  </section>
`;

export const pages = [
  { path: '/', title: 'crea8.one', file: 'index.html', main: home },
  { path: '/schedule', title: 'Schedule', file: 'schedule/index.html', main: schedule },
  { path: '/link', title: 'Link in Bio', file: 'link/index.html', main: link },
  { path: '/stalker', title: 'Stalker', file: 'stalker/index.html', main: stalker },
  { path: '/channels', title: 'Channels', file: 'channels/index.html', main: channelPage },
  { path: '/pricing', title: 'Pricing', file: 'pricing/index.html', main: pricing },
  { path: '/agent', title: 'Agent', file: 'agent/index.html', main: agent },
  { path: '/mcp', title: 'MCP', file: 'mcp/index.html', main: mcp },
  { path: '/chatgpt', title: 'ChatGPT', file: 'chatgpt/index.html', main: chatgpt },
  { path: '/claude', title: 'Claude', file: 'claude/index.html', main: claude },
  { path: '/claude-code', title: 'Claude Code', file: 'claude-code/index.html', main: claudeCode },
  { path: '/cursor', title: 'Cursor', file: 'cursor/index.html', main: cursor },
  { path: '/grok-bot', title: 'Grok Bot', file: 'grok-bot/index.html', main: grok },
  { path: '/cli', title: 'CLI', file: 'cli/index.html', main: cli },
  { path: '/about', title: 'About', file: 'about/index.html', main: about },
  { path: '/contact', title: 'Contact', file: 'contact/index.html', main: contact },
  { path: '/404', title: '404', file: '404.html', main: missing },
];

export const REQUIRED_PATHS = [
  '/',
  '/schedule',
  '/link',
  '/stalker',
  '/channels',
  '/pricing',
  '/agent',
  '/mcp',
  '/chatgpt',
  '/claude',
  '/claude-code',
  '/cursor',
  '/grok-bot',
  '/cli',
  '/about',
  '/contact',
];
