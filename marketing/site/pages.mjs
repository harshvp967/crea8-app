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
    month: '$19',
    period: 'a month',
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
    month: '$39',
    period: 'a month',
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
    month: '$59',
    period: 'a month',
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
    month: '$99',
    period: 'a month',
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

const themes = [
  { label: 'Midnight', background: '#071418' },
  { label: 'Paper', background: '#f6f3ee' },
  { label: 'Sand', background: '#e7d3b4' },
  { label: 'Ocean', background: '#071824' },
  { label: 'Bloom', background: '#f7e7ee' },
  { label: 'Aurora', background: '#12081f' },
  { label: 'Noir', background: '#0e0e0e' },
  { label: 'Forest', background: '#102117' },
  { label: 'Sunset', background: '#2a120c' },
];

const socials = [
  { name: 'Instagram', icon: 'instagram.png' },
  { name: 'X', icon: 'x.png' },
  { name: 'YouTube', icon: 'youtube.png' },
  { name: 'LinkedIn', icon: 'linkedin.png' },
  { name: 'TikTok', icon: 'tiktok.png' },
  { name: 'Threads', icon: 'threads.png' },
  { name: 'Facebook', icon: 'facebook.png' },
  { name: 'Bluesky', icon: 'bluesky.png' },
  { name: 'Twitch', icon: 'twitch.png' },
  { name: 'Pinterest', icon: 'pinterest.png' },
  { name: 'Reddit', icon: 'reddit.png' },
  { name: 'Website', icon: '' },
];

const scheduleNav = ['Calendar', 'Composer', 'Agent', 'Analytics', 'Media', 'Plugs', 'Integrations', 'Settings'];
const stalkerNav = ['Mentions', 'Analytics', 'Themes', 'Keywords', 'Alerts', 'Settings'];
const linkNav = ['Editor', 'Appearance', 'Settings', 'Analytics', 'Leads'];

const agentLinks = [
  ['/mcp', 'MCP', 'mcp.crea8.one/mcp'],
  ['/chatgpt', 'ChatGPT', 'mcp-oauth-chatgpt'],
  ['/claude', 'Claude', 'mcp-oauth-claude'],
  ['/claude-code', 'Claude Code', 'claude mcp add'],
  ['/cursor', 'Cursor', 'mcp-oauth-dynamic'],
  ['/grok-bot', 'Grok Bot', 'api.crea8.one'],
  ['/cli', 'CLI', 'crea8'],
];

function esc(text) {
  return String(text).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

function pre(text) {
  return `<pre class="snippet">${esc(text)}</pre>`;
}

function faq(items) {
  return `<div class="faq">${items
    .map(
      ([question, answer]) => `<details>
        <summary>${esc(question)}</summary>
        <p>${esc(answer)}</p>
      </details>`
    )
    .join('')}</div>`;
}

function icon(file) {
  if (!file) {
    return '<span class="mark-web" aria-hidden="true"></span>';
  }
  return `<img src="/icons/${file}" alt="">`;
}

function channelGrid(items, soon) {
  return `<div class="logos">${items
    .map(
      (item) => `<div class="logo-tile${soon ? ' is-soon' : ''}">
        ${icon(item.icon)}
        <span>${esc(item.name)}</span>
        ${soon ? '<span class="soon">Coming soon</span>' : ''}
      </div>`
    )
    .join('')}</div>`;
}

function sourceRow(items) {
  return `<div class="sources">${items
    .map(
      (item) => `<div class="source${item.soon ? ' is-soon' : ''}">
        ${icon(item.icon)}
        <span>${esc(item.name)}</span>
        ${item.soon ? '<span class="soon">Coming soon</span>' : ''}
      </div>`
    )
    .join('')}</div>`;
}

function appFrame(active, links, current, body, hidden = true) {
  const apps = [
    ['schedule', 'Schedule'],
    ['stalker', 'Stalker'],
    ['link', 'Link in Bio'],
  ];
  const appHtml = apps
    .map(
      ([id, label]) =>
        `<div class="app-app${id === active ? ' is-on' : ''}"><span class="app-dot"></span><span>${label}</span></div>`
    )
    .join('');
  const linkHtml = links
    .map((label) => `<div class="app-link${label === current ? ' is-on' : ''}">${esc(label)}</div>`)
    .join('');
  const hiddenAttr = hidden ? ' aria-hidden="true"' : '';
  return `<div class="app"${hiddenAttr}><aside class="app-side"><div class="app-logo"><img src="/crea8one-icon-cyan.svg" alt=""></div><div class="app-apps">${appHtml}</div><div class="app-rule"></div><div class="app-links">${linkHtml}</div></aside><div class="app-main">${body}</div></div>`;
}

function calendarBody() {
  const days = [
    ['Mon', 'x.png', 'Draft'],
    ['Tue', '', ''],
    ['Wed', 'linkedin.png', '9:00'],
    ['Thu', '', ''],
    ['Fri', 'youtube.png', 'Draft'],
    ['Sat', '', ''],
    ['Sun', '', ''],
  ];
  const cells = days
    .map(([name, file, label]) => {
      const slot = file
        ? `<div class="slot">${icon(file)}<span>${esc(label)}</span></div>`
        : '';
      return `<div class="day"><span class="dow">${name}</span><div class="slots">${slot}</div></div>`;
    })
    .join('');
  return `<div class="screen-title">Calendar</div><div class="week">${cells}</div>`;
}

function composerBody() {
  return `<div class="screen-title">Composer</div>
    <div class="composer">
      <div class="composer-text">Text</div>
      <div class="composer-row">
        <span class="composer-label">Channels</span>
        ${icon('x.png')}${icon('linkedin.png')}${icon('reddit.png')}
      </div>
      <div class="composer-row">
        <span class="composer-label">Time</span>
        <span class="tag">Draft</span>
        <span class="tag">Publish now</span>
        <span class="tag">Media</span>
      </div>
    </div>`;
}

function mention(file, status) {
  return `<div class="mention">${icon(file)}<div class="bars"><i></i><i></i></div><span class="status">${esc(status)}</span></div>`;
}

function stalkerBody() {
  return `<div class="screen-title">Mentions</div>
    <div class="filters"><span>X</span><span>Reddit</span><span>YouTube</span><span class="is-soon">LinkedIn</span></div>
    <div class="feed">
      ${mention('x.png', 'NEW')}
      ${mention('reddit.png', 'REPLIED')}
      ${mention('youtube.png', 'IGNORED')}
    </div>`;
}

function phonePage(full) {
  const more = full
    ? `<div class="phone-heading">Heading</div>
      <p class="phone-copy">Text</p>
      <div class="phone-faq"><span>FAQ</span></div>
      <div class="phone-discount">Discount</div>
      <div class="phone-feature">Featured post</div>
      <div class="phone-embed">Embed</div>
      <div class="phone-carousel"><i></i><i></i><i></i><span>Image carousel</span></div>
      <div class="phone-block">Contact form</div>
      <div class="phone-block">Map</div>
      <div class="phone-block">Calendly</div>
      <div class="phone-block">Contact details</div>
      <div class="phone-block">Events</div>
      <div class="phone-block">Music</div>
      <div class="phone-embed">Latest YouTube</div>`
    : `<div class="phone-faq"><span>FAQ</span></div>`;
  const social = socials
    .slice(0, full ? socials.length : 6)
    .map((item) => icon(item.icon))
    .join('');
  return `<div class="phone"><div class="phone-top">crea8.one/@username</div><div class="phone-page"><strong>Studio</strong><p>Links</p><div class="phone-socials">${social}</div><div class="phone-link">Link</div><div class="phone-email"><span>Email capture</span><i></i></div>${more}</div></div>`;
}

function linkBody(full) {
  return `<div class="screen-title">Editor</div><div class="link-fit">${phonePage(full)}</div>`;
}

function scheduleShot() {
  return appFrame('schedule', scheduleNav, 'Calendar', calendarBody());
}

function composerShot() {
  return appFrame('schedule', scheduleNav, 'Composer', composerBody());
}

function stalkerShot() {
  return appFrame('stalker', stalkerNav, 'Mentions', stalkerBody());
}

function linkShot(full) {
  return appFrame('link', linkNav, 'Editor', linkBody(full), !full);
}

function planCards() {
  return `<div class="plans">${plans
    .map(
      (plan) => `<article class="plan">
        <h3>${esc(plan.name)}</h3>
        <p class="price">${esc(plan.month)} <span>${esc(plan.period)}</span></p>
        <p class="price-year">${esc(plan.year)}</p>
        <ul>${plan.lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      </article>`
    )
    .join('')}</div>`;
}

function packCards() {
  const packs = [
    ['7-day trial', '$0', ['50 credits']],
    ['150 credits', '$5', []],
    ['500 credits', '$15', []],
  ];
  return `<div class="packs">${packs
    .map(
      ([name, price, lines]) => `<article class="plan">
        <h3>${esc(name)}</h3>
        <p class="price">${esc(price)}</p>
        ${lines.length ? `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
      </article>`
    )
    .join('')}</div>`;
}

function agentTiles() {
  return `<div class="agents">${agentLinks
    .map(
      ([href, name, path]) =>
        `<a class="agent-card" href="${href}"><h3>${esc(name)}</h3><code>${esc(path)}</code></a>`
    )
    .join('')}</div>`;
}

function themeSwatches() {
  return `<div class="swatches">${themes
    .map(
      (theme) =>
        `<div class="swatch"><i style="background:${theme.background}"></i><span>${esc(theme.label)}</span></div>`
    )
    .join('')}</div>`;
}

function layoutCards() {
  return `<div class="layouts">
    <div class="layout"><div class="wire wire-classic"><i></i><i></i><i></i></div><span>Classic</span></div>
    <div class="layout"><div class="wire wire-featured"><b></b><i></i><i></i></div><span>Featured</span></div>
    <div class="layout"><div class="wire wire-card"><b></b></div><span>Card</span></div>
    <div class="layout"><div class="wire wire-tile"><i></i><i></i><i></i><i></i></div><span>Tile</span></div>
  </div>`;
}

function cta() {
  return `<section class="cta">
    <h2>Start</h2>
    <div class="actions">
      <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
      <a class="btn btn-secondary" href="https://app.crea8.one/login">Log in</a>
    </div>
  </section>`;
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
    <div class="hero-copy">
      <h1>crea8.one</h1>
      <div class="actions">
        <a class="btn btn-primary" href="/agent">Agent</a>
        <a class="btn btn-secondary" href="/schedule">Schedule</a>
      </div>
    </div>
    <div class="shot">${scheduleShot()}</div>
  </section>
  <section class="block">
    <h2>Who it's for</h2>
    <div class="who">
      <article class="who-card"><h3>AI-first marketers</h3></article>
      <article class="who-card"><h3>Developers</h3></article>
      <article class="who-card"><h3>Automation teams</h3></article>
    </div>
  </section>
  <section class="block">
    <h2><a href="/channels">Channels</a></h2>
    ${channelGrid(channels, false)}
    <h2>Coming soon</h2>
    ${channelGrid(comingSoon, true)}
  </section>
  <section class="feature">
    <div class="feature-copy">
      <h2><a href="/schedule">Schedule</a></h2>
    </div>
    <div class="shot">${composerShot()}</div>
  </section>
  <section class="feature feature-flip">
    <div class="shot">${linkShot(false)}</div>
    <div class="feature-copy">
      <h2><a href="/link">Link in Bio</a></h2>
    </div>
  </section>
  <section class="feature">
    <div class="feature-copy">
      <h2><a href="/stalker">Stalker</a></h2>
    </div>
    <div class="shot">${stalkerShot()}</div>
  </section>
  <section class="block">
    <h2><a href="/agent">Agent</a></h2>
    ${agentTiles()}
    ${pre('https://mcp.crea8.one/mcp\nAuthorization: Bearer <API key>\n\nhttps://mcp.crea8.one/mcp-oauth-dynamic')}
  </section>
  <section class="block">
    <h2><a href="/pricing">Pricing</a></h2>
    <p class="lead">USD.</p>
    ${planCards()}
    ${packCards()}
  </section>
  <section class="block">
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
  ${cta()}
`;

const schedule = `
  <section class="page-hero">
    <h1>Schedule</h1>
    <p class="lead">Schedule stays closed until a plan or the trial exists.</p>
  </section>
  <div class="shot">${scheduleShot()}</div>
  <section class="block">
    <h2>Composer</h2>
    <div class="shot">${composerShot()}</div>
  </section>
  ${cta()}
`;

const link = `
  <section class="page-hero">
    <h1>Link in Bio</h1>
    <p class="lead">Link in Bio stays open without a plan or trial.</p>
  </section>
  <div class="shot">${linkShot(true)}</div>
  <section class="block">
    <h2>Address</h2>
    <p class="lead">The public URL is https://crea8.one/@username. A live custom domain replaces that URL.</p>
  </section>
  <section class="block">
    <h2>Themes</h2>
    <p class="lead">Every theme is free on every plan.</p>
    ${themeSwatches()}
  </section>
  <section class="block">
    <h2>Layouts</h2>
    ${layoutCards()}
  </section>
  <section class="block">
    <h2>Buttons</h2>
    <div class="samples">
      <span class="sample is-pill">Pill</span>
      <span class="sample is-rounded">Rounded</span>
      <span class="sample is-square">Square</span>
    </div>
  </section>
  <section class="block">
    <h2>Fonts</h2>
    <div class="fonts">
      <span style="font-family: Inter, sans-serif">Plus Jakarta Sans</span>
      <span style="font-family: Georgia, serif">Georgia</span>
      <span style="font-family: Palatino, 'Palatino Linotype', serif">Palatino</span>
      <span style="font-family: 'Trebuchet MS', sans-serif">Trebuchet MS</span>
      <span style="font-family: 'Courier New', monospace">Courier New</span>
    </div>
  </section>
  <section class="block">
    <h2>Socials</h2>
    ${sourceRow(socials)}
  </section>
  ${cta()}
`;

const stalker = `
  <section class="page-hero">
    <h1>Stalker</h1>
    <p class="lead">Stalker stays closed until a plan or the trial exists.</p>
  </section>
  <div class="shot">${stalkerShot()}</div>
  <section class="block">
    <h2>Search</h2>
    ${sourceRow([
      { name: 'X', icon: 'x.png' },
      { name: 'Reddit', icon: 'reddit.png' },
      { name: 'YouTube', icon: 'youtube.png' },
      { name: 'LinkedIn', icon: 'linkedin.png', soon: true },
    ])}
  </section>
  <section class="block">
    <h2>Comments</h2>
    ${sourceRow([
      { name: 'YouTube', icon: 'youtube.png' },
      { name: 'Instagram', icon: 'instagram.png' },
      { name: 'Facebook', icon: 'facebook.png' },
    ])}
  </section>
  <section class="block">
    <h2>Reply</h2>
    <p class="lead">A reply is reviewed before it is sent. Nothing is sent or scheduled automatically.</p>
    ${sourceRow([
      { name: 'YouTube', icon: 'youtube.png' },
      { name: 'Facebook', icon: 'facebook.png' },
      { name: 'Instagram', icon: 'instagram.png' },
      { name: 'X', icon: 'x.png' },
    ])}
  </section>
  <section class="block">
    <h2>Screens</h2>
    <div class="picker">${stalkerNav.map((name) => `<div class="pick"><span>${esc(name)}</span></div>`).join('')}</div>
  </section>
  <section class="block">
    <h2>API</h2>
    <p class="lead">Stalker commands on the API require STALKER_ENABLED to be the string true.</p>
  </section>
  ${cta()}
`;

const channelPage = `
  <section class="page-hero">
    <h1>Channels</h1>
  </section>
  ${channelGrid(channels, false)}
  <section class="block">
    <h2>Coming soon</h2>
    ${channelGrid(comingSoon, true)}
  </section>
  ${cta()}
`;

const pricing = `
  <section class="page-hero">
    <h1>Pricing</h1>
    <p class="lead">USD. GST is added at checkout.</p>
  </section>
  ${planCards()}
  ${packCards()}
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
  ${cta()}
`;

const agent = `
  <section class="page-hero">
    <h1>Agent</h1>
  </section>
  ${agentTiles()}
  ${pre('https://mcp.crea8.one/mcp\nAuthorization: Bearer <API key>\n\nhttps://mcp.crea8.one/mcp-oauth-dynamic\nhttps://mcp.crea8.one/mcp-oauth-chatgpt\nhttps://mcp.crea8.one/mcp-oauth-claude')}
  ${cta()}
`;

const mcp = `
  <section class="page-hero">
    <h1>MCP</h1>
    <p class="lead">https://api.crea8.one is the same API and keeps the same paths.</p>
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('https://mcp.crea8.one/mcp\nAuthorization: Bearer <API key>')}
  </section>
  <section class="block">
    <h2>Key in the URL</h2>
    ${pre('https://mcp.crea8.one/mcp/<API key>')}
  </section>
  <section class="block">
    <h2>OAuth</h2>
    <p class="lead">OAuth is authorization code with PKCE (S256).</p>
    ${pre('https://mcp.crea8.one/mcp-oauth-dynamic')}
  </section>
  <section class="block">
    <h2>ChatGPT</h2>
    ${pre('https://mcp.crea8.one/mcp-oauth-chatgpt')}
  </section>
  <section class="block">
    <h2>Claude</h2>
    ${pre('https://mcp.crea8.one/mcp-oauth-claude')}
  </section>
  <section class="block">
    <h2>Issuer metadata</h2>
    <p class="lead">Both list authorization_code and refresh_token. /mcp-oauth-claude uses the dynamic issuer.</p>
    ${pre('https://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-dynamic\nhttps://mcp.crea8.one/.well-known/oauth-authorization-server/mcp-oauth-chatgpt')}
  </section>
`;

const chatgpt = `
  <section class="page-hero">
    <h1>ChatGPT</h1>
    <p class="lead">In ChatGPT go to Settings &gt; Connectors &gt; Create and paste this URL.</p>
  </section>
  <section class="block">
    <h2>Custom connector</h2>
    ${pre('https://mcp.crea8.one/mcp-oauth-dynamic')}
    ${pre('https://mcp.crea8.one/mcp-oauth-chatgpt')}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('https://mcp.crea8.one/mcp/<API key>')}
  </section>
`;

const claude = `
  <section class="page-hero">
    <h1>Claude</h1>
    <p class="lead">In Claude go to Settings &gt; Connectors &gt; Add custom connector and paste this URL.</p>
  </section>
  <section class="block">
    <h2>Custom connector</h2>
    ${pre('https://mcp.crea8.one/mcp-oauth-dynamic')}
    ${pre('https://mcp.crea8.one/mcp-oauth-claude')}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('https://mcp.crea8.one/mcp/<API key>')}
  </section>
`;

const claudeCode = `
  <section class="page-hero">
    <h1>Claude Code</h1>
    <p class="lead">Run this command in your terminal.</p>
  </section>
  <section class="block">
    <h2>OAuth</h2>
    ${pre('claude mcp add crea8one --transport http "https://mcp.crea8.one/mcp-oauth-dynamic"')}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('claude mcp add --transport http crea8one https://mcp.crea8.one/mcp --header "Authorization: Bearer <API key>"')}
  </section>
`;

const cursor = `
  <section class="page-hero">
    <h1>Cursor</h1>
    <p class="lead">Add to .cursor/mcp.json in your project root.</p>
  </section>
  <section class="block">
    <h2>OAuth</h2>
    ${pre(cursorOauth)}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre(cursorKey)}
  </section>
`;

const grok = `
  <section class="page-hero">
    <h1>Grok Bot</h1>
    <p class="lead">Paste this into the chat. The agent will ask you for your API key.</p>
  </section>
  <section class="block">
    <h2>Chat</h2>
    ${pre('Ask me for my crea8.one API key and send requests to the crea8.one API with it as the Authorization header.')}
    ${pre('https://api.crea8.one\nAuthorization: Bearer <API key>')}
  </section>
`;

const cli = `
  <section class="page-hero">
    <h1>CLI</h1>
    <p class="lead">The command is crea8. It reads CREA8_API_KEY.</p>
  </section>
  <section class="block">
    <h2>Origin</h2>
    <p class="lead">CRE8_API_KEY still works and is deprecated. CRE8_API_URL overrides the API origin. The default origin is https://api.crea8.one.</p>
  </section>
  <section class="block">
    <h2>Install</h2>
    <p class="lead">Run it with Node 22 from skills/crea8one-agent/bin/crea8.mjs. npx skills add installs that folder from this repository.</p>
    ${pre('export CREA8_API_KEY=your_api_key\nnode skills/crea8one-agent/bin/crea8.mjs integrations:list')}
  </section>
  <section class="block">
    <h2>Posts</h2>
    ${pre(`crea8 integrations:list
crea8 groups:list
crea8 integrations:settings <integration-id>
crea8 integrations:trigger <integration-id> <methodName> --data '{"subreddit":"programming"}'
crea8 posts:create --content "Hello" --date "2026-10-14T09:00:00.000Z" --integration "id-one,id-two"
crea8 posts:create --json campaign.json
crea8 posts:list
crea8 posts:delete <post-id>
crea8 posts:settings <post-id> --settings '{"title":"New title"}'
crea8 posts:create --draft
crea8 posts:create --now
crea8 posts:create --media https://...
crea8 upload ./file.png
crea8 analytics:platform <integration-id> --days 30
crea8 analytics:post <post-id> --days 7`)}
  </section>
  <section class="block">
    <h2>Stalker</h2>
    <p class="lead">Stalker commands require STALKER_ENABLED on the API.</p>
    ${pre(`crea8 stalker:projects
crea8 stalker:mentions --project <project-id> --date 7d
crea8 stalker:keywords --project <project-id>
crea8 stalker:keywords:add --project <project-id> --phrase "brand" --reddit
crea8 stalker:keywords:delete <keyword-id>
crea8 stalker:alerts --project <project-id>
crea8 stalker:rules --project <project-id>
crea8 stalker:rules:add --project <project-id> --name "Negatives" --filters '{"sentiment":"NEGATIVE"}'
crea8 stalker:rules:delete <rule-id>
crea8 stalker:alerts:read <alert-id>`)}
  </section>
  <section class="block">
    <h2>Link in Bio</h2>
    ${pre(`crea8 link:get
crea8 link:update --json '{"name":"Studio","bio":"Links"}'
crea8 link:slug my-name
crea8 link:blocks:add --type LINK --title "Site" --url "https://example.com"
crea8 link:blocks:update <block-id> --json '{"title":"New title"}'
crea8 link:blocks:delete <block-id>
crea8 link:analytics --range 30d
crea8 link:leads`)}
  </section>
  <section class="block">
    <h2>Result</h2>
    <p class="lead">Every command prints JSON. A non-zero exit means the API rejected the call. The body is on stderr.</p>
  </section>
`;

const about = `
  <section class="page-hero">
    <h1>About</h1>
  </section>
  <div class="who">
    <a class="who-card" href="/schedule"><h3>Schedule</h3></a>
    <a class="who-card" href="/link"><h3>Link in Bio</h3></a>
    <a class="who-card" href="/stalker"><h3>Stalker</h3></a>
    <a class="who-card" href="/mcp"><h3>MCP</h3></a>
    <a class="who-card" href="/cli"><h3>CLI</h3></a>
    <a class="who-card" href="/channels"><h3>Channels</h3></a>
  </div>
  <p class="lead"><a href="mailto:support@crea8.one">support@crea8.one</a></p>
`;

const contact = `
  <section class="page-hero">
    <h1>Contact</h1>
    <p class="contact-mail"><a href="mailto:support@crea8.one">support@crea8.one</a></p>
    <p class="lead">Email support@crea8.one if you need help.</p>
  </section>
`;

const missing = `
  <section class="not-found">
    <p class="not-code">404</p>
    <h1>This page could not be found.</h1>
    <a class="btn btn-primary" href="/">Back to home</a>
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
