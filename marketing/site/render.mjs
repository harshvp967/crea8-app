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
    if (button) {
      button.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  apply(mode);
  document.addEventListener('DOMContentLoaded', function () { apply(mode); });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    var next = mode === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('mode', next); } catch (e) {}
    apply(next);
  });
})();`;

const NAV = [
  ['/schedule', 'Schedule'],
  ['/link', 'Link in Bio'],
  ['/stalker', 'Stalker'],
  ['/channels', 'Channels'],
  ['/pricing', 'Pricing'],
  ['/agent', 'Agent'],
];

const FOOTER = [
  [
    'Product',
    [
      ['/schedule', 'Schedule'],
      ['/link', 'Link in Bio'],
      ['/stalker', 'Stalker'],
      ['/channels', 'Channels'],
      ['/pricing', 'Pricing'],
    ],
  ],
  [
    'Agent',
    [
      ['/agent', 'Agent'],
      ['/mcp', 'MCP'],
      ['/cli', 'CLI'],
      ['/chatgpt', 'ChatGPT'],
      ['/claude', 'Claude'],
      ['/claude-code', 'Claude Code'],
      ['/cursor', 'Cursor'],
      ['/grok-bot', 'Grok Bot'],
    ],
  ],
  [
    'Account',
    [
      ['/about', 'About'],
      ['/contact', 'Contact'],
      ['https://app.crea8.one/register', 'Start'],
      ['https://app.crea8.one/login', 'Log in'],
      ['https://app.crea8.one/privacy', 'Privacy'],
      ['https://app.crea8.one/terms', 'Terms'],
    ],
  ],
];

function nav(path) {
  return NAV.map(([href, label]) => {
    const current = href === path ? ` aria-current="page"` : '';
    return `<a href="${href}"${current}>${label}</a>`;
  }).join('');
}

function footer() {
  const columns = FOOTER.map(
    ([title, links]) => `<div class="footer-col">
      <h2>${title}</h2>
      ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
    </div>`
  ).join('');
  return `<div class="footer-brand">
      <a class="brand" href="/" aria-label="crea8.one">
        <img class="brand-mark" src="/crea8one-icon-cyan.svg" alt="">
        <span class="brand-word">
          <img class="wordmark-light" src="/crea8one-logo-horizontal-color.svg" alt="">
          <img class="wordmark-dark" src="/crea8one-logo-horizontal-color-on-dark.svg" alt="">
        </span>
      </a>
      <a href="mailto:support@crea8.one">support@crea8.one</a>
    </div>${columns}`;
}

export function renderPage({ path, title, main }) {
  const documentTitle = title === 'crea8.one' ? 'crea8.one' : `${title} · crea8.one`;
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
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
  <header class="site-header">
    <div class="wrap header-bar">
      <a class="brand" href="/" aria-label="crea8.one">
        <img class="brand-mark" src="/crea8one-icon-cyan.svg" alt="">
        <span class="brand-word">
          <img class="wordmark-light" src="/crea8one-logo-horizontal-color.svg" alt="">
          <img class="wordmark-dark" src="/crea8one-logo-horizontal-color-on-dark.svg" alt="">
        </span>
      </a>
      <nav class="nav" aria-label="Pages">${nav(path)}</nav>
      <div class="header-actions">
        <button type="button" class="icon-btn" data-theme-toggle aria-label="Switch to light mode">
          <svg class="icon-sun" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M9 1.5v1.8M9 14.7v1.8M1.5 9h1.8M14.7 9h1.8M3.4 3.4l1.3 1.3M13.3 13.3l1.3 1.3M14.6 3.4l-1.3 1.3M4.7 13.3l-1.3 1.3"/></svg>
          <svg class="icon-moon" viewBox="0 0 18 18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M14.5 11.2A6.2 6.2 0 0 1 6.8 3.5 6.2 6.2 0 1 0 14.5 11.2z"/></svg>
        </button>
        <a class="btn btn-secondary" href="https://app.crea8.one/login">Log in</a>
        <a class="btn btn-primary" href="https://app.crea8.one/register">Start</a>
      </div>
    </div>
  </header>
  <main id="content" class="wrap">${main}</main>
  <footer class="site-footer">
    <div class="wrap footer-grid">${footer()}</div>
  </footer>
</body>
</html>
`;
}
