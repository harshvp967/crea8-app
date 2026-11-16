import { siteStealth } from './stealth.mjs';

const THEME_SCRIPT = `(function () {
  var mode = 'dark';
  try {
    var stored = localStorage.getItem('mode');
    if (stored === 'light' || stored === 'dark') mode = stored;
  } catch (e) {}
  function apply(next) {
    mode = next;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
    var button = document.querySelector('[data-theme-toggle]');
    if (button) button.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  apply(mode);
  document.addEventListener('DOMContentLoaded', function () { apply(mode); });
  document.addEventListener('click', function (event) {
    var themeButton = event.target.closest('[data-theme-toggle]');
    if (themeButton) {
      var next = mode === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('mode', next); } catch (e) {}
      apply(next);
      return;
    }
    var burger = event.target.closest('[data-menu-toggle]');
    if (!burger) return;
    var nav = document.querySelector('.navlinks');
    if (!nav) return;
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();`;

const NAV = [
  ['/schedule', 'Schedule'],
  ['/link', 'Link in Bio'],
  ['/stalker', 'Stalker'],
  ['/agent', 'Agent'],
  ['/pricing', 'Pricing']
];

const FOOTER = [
  ['Product', [['/schedule', 'Schedule'], ['/link', 'Link in Bio'], ['/stalker', 'Stalker'], ['/channels', 'Channels'], ['/pricing', 'Pricing']]],
  ['Agent', [['/agent', 'Agent'], ['/mcp', 'MCP'], ['/cli', 'CLI'], ['/chatgpt', 'ChatGPT'], ['/claude', 'Claude'], ['/claude-code', 'Claude Code'], ['/cursor', 'Cursor'], ['/grok-bot', 'Grok Bot']]],
  ['Account', [['/about', 'About'], ['/contact', 'Contact'], ['https://app.crea8.one/register', 'Start'], ['https://app.crea8.one/login', 'Log in'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/data-deletion', 'Data deletion'], ['/refund-policy', 'Refunds']]]
];

const MARK = `<img src="/crea8one-icon-cyan.svg" alt="" width="30" height="30">`;
const BURGER = `<svg
  data-i="lucide lucide-menu"
  xmlns="http://www.w3.org/2000/svg"
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <line x1="4" x2="20" y1="12" y2="12" />
  <line x1="4" x2="20" y1="6" y2="6" />
  <line x1="4" x2="20" y1="18" y2="18" />
</svg>`;

function brand() {
  return `<a class="brand" href="/" aria-label="crea8.one">${MARK}<span class="brandword">crea8.one</span></a>`;
}

function nav(path) {
  return NAV.map(([href, label]) => {
    const current = href === path ? ' class="on" aria-current="page"' : '';
    return `<a href="${href}"${current}>${label}</a>`;
  }).join('');
}

function footer(path) {
  const columns = FOOTER.map(([title, links]) => `<div class="fcol"><h2>${title}</h2>${links.map(([href, label]) => {
    const current = href === path ? ' aria-current="page"' : '';
    const rel = href.startsWith('http') ? ' rel="noopener noreferrer"' : '';
    return `<a href="${href}"${current}${rel}>${label}</a>`;
  }).join('')}</div>`).join('');
  return `<div class="fbrand">${brand()}</div>${columns}`;
}

function escapeAttr(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export function renderPage({ path, title, main, description }) {
  const stealth = siteStealth();
  const documentTitle = title === 'crea8.one' ? 'crea8.one' : `${title} · crea8.one`;
  const robots = stealth ? 'noindex, nofollow' : 'index, follow';
  const canonical = path === '/' ? 'https://crea8.one/' : `https://crea8.one${path}`;
  const launchMeta = stealth
    ? ''
    : `${description ? `\n  <meta name="description" content="${escapeAttr(description)}">` : ''}
  <link rel="canonical" href="${canonical}">`;
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${robots}">${launchMeta}
  <title>${documentTitle}</title>
  <link rel="icon" href="/crea8one-favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/crea8one-favicon-32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="/crea8one-favicon.ico" type="image/x-icon">
  <link rel="apple-touch-icon" href="/crea8one-apple-touch-icon.png" sizes="180x180">
  <link rel="stylesheet" href="/site.css">
  <script>${THEME_SCRIPT}</script>
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <div class="page">
    <div class="wrap nav">
      ${brand()}
      <nav class="navlinks" aria-label="Pages">${nav(path)}</nav>
      <div class="navcta">
        <button type="button" class="theme-btn" data-theme-toggle aria-label="Switch to light mode"><svg class="icon-sun" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M9 1.5v1.8M9 14.7v1.8M1.5 9h1.8M14.7 9h1.8M3.4 3.4l1.3 1.3M13.3 13.3l1.3 1.3M14.6 3.4l-1.3 1.3M4.7 13.3l-1.3 1.3"/></svg><svg class="icon-moon" viewBox="0 0 18 18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M14.5 11.2A6.2 6.2 0 0 1 6.8 3.5 6.2 6.2 0 1 0 14.5 11.2z"/></svg></button>
        <a class="btn s sm nav-login" href="https://app.crea8.one/login" rel="noopener noreferrer"><span>Log in</span></a>
        <a class="btn p sm" href="https://app.crea8.one/register" rel="noopener noreferrer"><span>Start for $0</span></a>
        <button type="button" class="burger" data-menu-toggle aria-expanded="false" aria-label="Menu"><svg
  data-i="lucide lucide-menu"
  xmlns="http://www.w3.org/2000/svg"
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <line x1="4" x2="20" y1="12" y2="12" />
  <line x1="4" x2="20" y1="6" y2="6" />
  <line x1="4" x2="20" y1="18" y2="18" />
</svg></button>
      </div>
    </div>
    <div class="glow"></div>
    <main id="content">${main}</main>
    <footer>
      <div class="wrap">
        <div class="fgrid">${footer(path)}</div>
        <div class="fbot"><span>© 2026 crea8.one</span><a href="mailto:support@crea8.one">support@crea8.one</a></div>
      </div>
    </footer>
  </div>
</body>
</html>
`;
}
