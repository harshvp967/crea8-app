import { dataDeletion, privacy, refunds, terms } from './legal.mjs';
import { PAGE_PATHS } from './paths.mjs';

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

const sharedLines = plans[0].lines.filter((line) => plans.every((plan) => plan.lines.includes(line)));
const homeLine = (line) =>
  /^\d|Unlimited team members|credits refill monthly|Stalker keywords/.test(line) &&
  (line.endsWith('channels') ||
    line.includes('team member') ||
    line.includes('credits refill monthly') ||
    line.includes('Stalker keywords'));

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
];

const scheduleNav = ['Calendar', 'Composer', 'Agent', 'Analytics', 'Media', 'Plugs', 'Integrations', 'Settings'];
const stalkerNav = ['Mentions', 'Analytics', 'Themes', 'Keywords', 'Alerts', 'Settings'];
const linkNav = ['Editor', 'Appearance', 'Settings', 'Analytics', 'Leads'];

const agentTiles = [
  ['/chatgpt', 'ChatGPT'],
  ['/claude', 'Claude'],
  ['/claude-code', 'Claude Code'],
  ['/cursor', 'Cursor'],
  ['/grok-bot', 'Grok Bot'],
  ['/cli', 'CLI'],
];

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

function esc(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function pre(text) {
  return `<pre class="snippet">${esc(text)}</pre>`;
}

function heroActions() {
  return `<div class="actions">
      <a class="btn btn-primary" href="https://app.crea8.one/register">Start 7-day trial for $0</a>
      <a class="btn btn-secondary" href="https://app.crea8.one/login">Log in</a>
    </div>`;
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
  if (!file) return '';
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

function channelWall() {
  return `<section class="block">
      <h2><a href="/channels">Publish to 25+ channels</a></h2>
      ${channelGrid(channels, false)}
    </section>`;
}

function appFrame(active, links, current, body) {
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
  return `<div class="app" aria-hidden="true"><aside class="app-side"><div class="app-logo"><img src="/crea8one-icon-cyan.svg" alt=""></div><div class="app-apps">${appHtml}</div><div class="app-rule"></div><div class="app-links">${linkHtml}</div></aside><div class="app-main">${body}</div></div>`;
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
      const slot = file ? `<div class="slot">${icon(file)}<span>${esc(label)}</span></div>` : '';
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

function phonePreview() {
  const social = socials.map((item) => icon(item.icon)).join('');
  return `<div class="phone" aria-hidden="true"><div class="phone-top">crea8.one/@you</div><div class="phone-page"><strong>Studio</strong><p>Links</p><div class="phone-socials">${social}</div><div class="phone-link">Link</div><div class="phone-email"><span>Email capture</span><i></i></div></div></div>`;
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

function linkShot() {
  return appFrame('link', linkNav, 'Editor', `<div class="screen-title">Editor</div><div class="link-fit">${phonePreview()}</div>`);
}

function framed(shot) {
  return `<div class="frame">${shot}</div>`;
}

function miniChannels() {
  return `<div class="mini" aria-hidden="true">${['x.png', 'linkedin.png', 'instagram.png', 'youtube.png', 'reddit.png', 'tiktok.png'].map(icon).join('')}</div>`;
}

function miniComposer() {
  return `<div class="mini-compose" aria-hidden="true"><span>Text</span><div class="composer-row">${icon('x.png')}${icon('linkedin.png')}<span class="tag">Draft</span><span class="tag">Publish now</span></div></div>`;
}

function miniMentions() {
  return `<div class="mini-feed" aria-hidden="true">${mention('x.png', 'NEW')}${mention('reddit.png', 'REPLIED')}</div>`;
}

function miniKeyword() {
  return `<div class="mini-compose" aria-hidden="true"><span>Keyword</span></div>`;
}

function steps(items) {
  return `<div class="steps">${items
    .map(
      ([title, visual, line]) => `<article class="step">
        <h3>${esc(title)}</h3>
        ${visual}
        ${line ? `<p>${esc(line)}</p>` : ''}
      </article>`
    )
    .join('')}</div>`;
}

function howItWorks() {
  return `<section class="block">
      <h2>How it works</h2>
      ${steps([
        ['Connect your channels', miniChannels(), ''],
        ['Create or schedule', miniComposer(), ''],
        ['Track and grow', miniMentions(), ''],
      ])}
    </section>`;
}

function themeSwatches() {
  return `<div class="swatches">${themes
    .map(
      (theme) =>
        `<div class="swatch"><i style="background:${theme.background}"></i><span>${esc(theme.label)}</span></div>`
    )
    .join('')}</div>`;
}

function planCards(mode) {
  return `<div class="plans">${plans
    .map((plan) => {
      const lines = mode === 'home' ? plan.lines.filter(homeLine) : plan.lines.filter((line) => !sharedLines.includes(line));
      return `<article class="plan">
        <h3>${esc(plan.name)}</h3>
        <p class="price">${esc(plan.month)} <span>${esc(plan.period)}</span></p>
        <p class="price-year">${esc(plan.year)}</p>
        <ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      </article>`;
    })
    .join('')}</div>`;
}

function everyPlan() {
  return `<section class="block">
      <h2>Every plan</h2>
      <ul class="shared">${sharedLines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
    </section>`;
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

function agentBoard() {
  return `<div class="agent-board">
      <a class="mcp-card" href="/mcp"><h3>MCP</h3></a>
      <div class="agent-tiles">${agentTiles
        .map(([href, name]) => `<a class="agent-card" href="${href}"><h3>${esc(name)}</h3></a>`)
        .join('')}</div>
    </div>`;
}

function banner(title) {
  return `<section class="banner">
      <h2>${esc(title)}</h2>
      ${heroActions()}
    </section>`;
}

function finalCta() {
  return `<section class="cta">
      <h2>Start your 7-day trial</h2>
      ${heroActions()}
    </section>`;
}

function pageHero(title) {
  return `<section class="page-hero">
      <h1>${esc(title)}</h1>
      ${heroActions()}
    </section>`;
}

const homeFaq = [
  [
    'What does the trial cost?',
    'The 7-day trial checks out at $0 and includes 50 credits. You are not charged today. GST is added at checkout.',
  ],
  [
    'What are the prices?',
    'Creator is $19 a month or $190 a year. Team is $39 a month or $390 a year. Pro is $59 a month or $590 a year. Agency is $99 a month or $990 a year. Prices are USD. GST is added at checkout.',
  ],
  [
    'Can I cancel?',
    'Cancel anytime from billing. Cancellation stops later charges. It does not, by itself, refund a period that has already started, unless a refund is required by law or granted by the merchant of record.',
  ],
  [
    'Where is MCP?',
    'https://mcp.crea8.one/mcp takes an API key as Authorization: Bearer. https://mcp.crea8.one/mcp/<API key> puts the key in the URL. https://mcp.crea8.one/mcp-oauth-dynamic is the OAuth URL for a client that registers itself. https://api.crea8.one is the same API.',
  ],
  [
    'Where do I sign in?',
    'Start at https://app.crea8.one/register. Log in at https://app.crea8.one/login.',
  ],
];

const pricingFaq = [
  [
    'When is the trial charged?',
    'You are not charged today. The 7-day trial checks out at $0. GST is added at checkout. Dodo Payments is the merchant of record. You can pay by card or UPI where Dodo offers it, and cancel anytime from billing. Email support@crea8.one if you need help.',
  ],
  [
    'When do plan credits start?',
    'The trial includes 50 credits. The plan monthly credits apply on the first successful charge.',
  ],
];

const home = `
  <div class="fold">
    <section class="hero">
      <h1>Schedule to 25+ channels from one app</h1>
      <p class="lead">crea8.one publishes your posts, runs your link in bio and finds every mention, for creators, teams and agencies.</p>
      ${heroActions()}
    </section>
    ${framed(scheduleShot())}
  </div>
  <section class="block">
    <h2>Who is crea8.one for?</h2>
    <div class="who">
      <article class="who-card"><h3>Creators</h3><p>Your channels on one calendar.</p></article>
      <article class="who-card"><h3>Teams</h3><p>One workspace for the people who post.</p></article>
      <article class="who-card"><h3>Agencies</h3><p>One login for client workspaces.</p></article>
    </div>
  </section>
  ${howItWorks()}
  ${channelWall()}
  <section class="block">
    <h2>One app. Three tools.</h2>
    <div class="tools">
      <article class="feature">
        <div class="feature-copy">
          <h3><a href="/schedule">Schedule</a></h3>
          <p class="lead">Post to 25+ channels from one calendar.</p>
        </div>
        <div class="shot">${scheduleShot()}</div>
      </article>
      <article class="feature feature-flip">
        <div class="shot">${linkShot()}</div>
        <div class="feature-copy">
          <h3><a href="/link">Link in Bio</a></h3>
          <p class="lead">Your page at crea8.one/@you.</p>
        </div>
      </article>
      <article class="feature">
        <div class="feature-copy">
          <h3><a href="/stalker">Stalker</a></h3>
          <p class="lead">Every mention of your brand, in one inbox.</p>
        </div>
        <div class="shot">${stalkerShot()}</div>
      </article>
    </div>
  </section>
  ${banner('Try crea8.one for $0')}
  <section class="block">
    <h2>Run it from your AI agent</h2>
    ${agentBoard()}
  </section>
  <section class="block">
    <h2><a href="/pricing">Pricing</a></h2>
    ${planCards('home')}
    <h2>Every plan</h2>
    <ul class="shared">${sharedLines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
    <a class="compare" href="/pricing">Compare plans</a>
  </section>
  <section class="block">
    <h2>FAQ</h2>
    ${faq(homeFaq)}
  </section>
  ${finalCta()}
`;

const schedule = `
  ${pageHero('Post to 25+ channels from one calendar')}
  ${framed(scheduleShot())}
  ${howItWorks()}
  <section class="feature">
    <div class="feature-copy">
      <h2>Composer</h2>
      <p class="lead">One post, then the channels and the time.</p>
    </div>
    <div class="shot">${composerShot()}</div>
  </section>
  ${banner('Start your 7-day trial')}
  ${channelWall()}
`;

const link = `
  ${pageHero('Your page at crea8.one/@you')}
  <section class="block">
    <h2>How it works</h2>
    ${steps([
      ['Claim your address', '<p class="address-chip">crea8.one/@you</p>', ''],
      ['Pick a theme', themeSwatches(), 'Every theme is on every plan.'],
      ['Share and track', phonePreview(), ''],
    ])}
  </section>
  <article class="plan preview-card">
    <h2>Link in Bio</h2>
    ${phonePreview()}
  </article>
`;

const stalker = `
  ${pageHero('Every mention of your brand, in one inbox')}
  ${framed(stalkerShot())}
  <section class="block">
    <h2>How it works</h2>
    ${steps([
      ['Add keywords', miniKeyword(), ''],
      ['Get every mention', miniMentions(), ''],
      ['Reply in one place', miniComposer(), 'Replies are reviewed before sending.'],
    ])}
  </section>
`;

const channelPage = `
  ${pageHero('25+ channels')}
  ${channelGrid(channels, false)}
  <section class="block">
    <h2>Coming soon</h2>
    ${channelGrid(comingSoon, true)}
  </section>
`;

const pricing = `
  ${pageHero('Every plan starts with a 7-day trial for $0.')}
  <section class="block">
    <p class="lead">Prices are USD. GST is added at checkout.</p>
    ${planCards('differ')}
  </section>
  ${everyPlan()}
  <section class="block">
    <h2>Credits</h2>
    ${packCards()}
  </section>
  ${faq(pricingFaq)}
`;

const agent = `
  ${pageHero('Run it from your AI agent')}
  ${agentBoard()}
`;

const mcp = `
  ${pageHero('MCP')}
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
    <p class="lead">Authorization code with PKCE (S256). https://api.crea8.one is the same API and keeps the same paths.</p>
    ${pre('https://mcp.crea8.one/mcp-oauth-dynamic')}
  </section>
`;

const chatgpt = `
  ${pageHero('ChatGPT')}
  <section class="block">
    <h2>Custom connector</h2>
    <p class="lead">In ChatGPT go to Settings, Connectors, Create, and paste this URL.</p>
    ${pre('https://mcp.crea8.one/mcp-oauth-chatgpt')}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('https://mcp.crea8.one/mcp/<API key>')}
  </section>
`;

const claude = `
  ${pageHero('Claude')}
  <section class="block">
    <h2>Custom connector</h2>
    <p class="lead">In Claude go to Settings, Connectors, Add custom connector, and paste this URL.</p>
    ${pre('https://mcp.crea8.one/mcp-oauth-claude')}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre('https://mcp.crea8.one/mcp/<API key>')}
  </section>
`;

const claudeCode = `
  ${pageHero('Claude Code')}
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
  ${pageHero('Cursor')}
  <section class="block">
    <h2>OAuth</h2>
    <p class="lead">Add to .cursor/mcp.json in your project root.</p>
    ${pre(cursorOauth)}
  </section>
  <section class="block">
    <h2>API key</h2>
    ${pre(cursorKey)}
  </section>
`;

const grok = `
  ${pageHero('Grok Bot')}
  <section class="block">
    <h2>API key</h2>
    <p class="lead">Paste this into the chat. The agent will ask you for your API key.</p>
    ${pre('Ask me for my crea8.one API key and send requests to the crea8.one API with it as the Authorization header.\n\nhttps://api.crea8.one\nAuthorization: Bearer <API key>')}
  </section>
`;

const cli = `
  ${pageHero('CLI')}
  <section class="block">
    <h2>Install</h2>
    <p class="lead">The command is crea8. It reads CREA8_API_KEY. CRE8_API_KEY still works and is deprecated. CRE8_API_URL overrides the API origin. The default origin is https://api.crea8.one. npx skills add installs skills/crea8one-agent from this repository. Run it with Node 22.</p>
    ${pre('export CREA8_API_KEY=your_api_key\nnode skills/crea8one-agent/bin/crea8.mjs integrations:list')}
  </section>
  <section class="block">
    <h2>Examples</h2>
    ${pre(`crea8 integrations:list
crea8 posts:create --content "Hello" --date "2026-10-14T09:00:00.000Z" --integration "id-one,id-two"
crea8 link:get`)}
    <p class="lead">Every command prints JSON. A non-zero exit means the API rejected the call. The body is on stderr.</p>
  </section>
`;

const about = `
  <section class="page-hero">
    <h1>About</h1>
    <p class="lead">crea8.one publishes your posts, runs your link in bio and finds every mention.</p>
    <p class="lead">Connect your channels, schedule a post, and read mentions from one login.</p>
    ${heroActions()}
  </section>
  <article class="support-card">
    <h2>support@crea8.one</h2>
    <a href="mailto:support@crea8.one">support@crea8.one</a>
  </article>
`;

const contact = `
  ${pageHero('Contact')}
`;

const missing = `
  <section class="not-found">
    <p class="not-code">404</p>
    <h1>This page could not be found.</h1>
    ${heroActions()}
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
  { path: '/privacy', title: 'Privacy', file: 'privacy/index.html', main: privacy, description: 'Privacy for crea8.one.' },
  { path: '/terms', title: 'Terms', file: 'terms/index.html', main: terms, description: 'Terms for crea8.one.' },
  {
    path: '/data-deletion',
    title: 'Data deletion',
    file: 'data-deletion/index.html',
    main: dataDeletion,
    description: 'Data deletion for crea8.one.',
  },
  {
    path: '/refund-policy',
    title: 'Refunds',
    file: 'refund-policy/index.html',
    main: refunds,
    description: 'Refunds for crea8.one.',
  },
  { path: '/404', title: '404', file: '404.html', main: missing },
];

export const REQUIRED_PATHS = PAGE_PATHS;
