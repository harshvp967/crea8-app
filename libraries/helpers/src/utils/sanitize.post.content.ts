import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'u',
  'a',
  'ul',
  'li',
  'h1',
  'h2',
  'h3',
  'span',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'class',
  'data-mention-id',
  'data-mention-label',
];

// isomorphic-dompurify pulls jsdom 29, whose html-encoding-sniffer require()s
// the ESM-only @exodus/bytes package. Next then 500s on /p/[id]. This uses the
// repo's CommonJS jsdom 22 with DOMPurify directly.
const DOMPurify = createDOMPurify(new JSDOM('').window);

export const sanitizePostContent = (value: unknown): string => {
  if (typeof value !== 'string' || !value) {
    return '';
  }

  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/(?!\/)|#)/i,
  });
};
