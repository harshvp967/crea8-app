// Plain-text helpers for Stalker mentions, shared by the API (on ingest) and
// the web app (for rows stored before the API decoded them). The output is
// plain text: render it as a React text node, never as HTML.

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

const ENTITY = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi;

const decodeOnce = (value: string) =>
  value.replace(ENTITY, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
        return match;
      }
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED[body.toLowerCase()];
    return named === undefined ? match : named;
  });

/** "Tom &amp;amp; Jerry&#39;s" -> "Tom & Jerry's" (handles double encoding). */
export const decodeHtmlEntities = (value?: string | null) => {
  let text = value || '';
  for (let pass = 0; pass < 3 && text.includes('&'); pass += 1) {
    const next = decodeOnce(text);
    if (next === text) {
      break;
    }
    text = next;
  }
  return text;
};

/** "@@ada " / "@ada" / "ada" -> "ada". Display adds a single "@". */
export const normalizeHandle = (value?: string | null) =>
  decodeHtmlEntities(value).trim().replace(/^@+/, '').trim();
