import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export function monthStart(now = new Date()) {
  return dayjs.utc(now).startOf('month');
}

export function loneUrl(idea: string): string | null {
  const trimmed = idea.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function ideaSource(idea: string, pageText?: string | null): string {
  const url = loneUrl(idea);
  const page = (pageText || '').replace(/\s+/g, ' ').trim();
  if (url && page) {
    return `Link: ${url}\n\n${page.slice(0, 6000)}`;
  }
  return idea.trim().slice(0, 4000);
}

export function clipPlain(text: string, maxLength: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!maxLength || maxLength < 1 || clean.length <= maxLength) {
    return clean;
  }
  return clean.slice(0, maxLength).trim();
}

export function plainToPostHtml(text: string): string {
  const escaped = (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const blocks = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) {
    return '<p></p>';
  }
  return blocks
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function futureSlot(raw: string | null | undefined, now = new Date()): string {
  const when = raw ? dayjs.utc(raw) : null;
  if (when?.isValid() && when.isAfter(dayjs.utc(now).add(2, 'minute'))) {
    return when.format('YYYY-MM-DDTHH:mm:ss');
  }
  return dayjs.utc(now).add(1, 'day').second(0).format('YYYY-MM-DDTHH:mm:ss');
}

export const IDEA_FORMATS = ['short', 'long', 'thread_short', 'thread_long'] as const;
export type IdeaFormat = (typeof IDEA_FORMATS)[number];
export const IDEA_VOICES = ['personal', 'company'] as const;
export type IdeaVoice = (typeof IDEA_VOICES)[number];

// Upstream short posts stay inside a tweet. A channel with a lower limit wins.
export const SHORT_POST_CAP = 200;
export const PERSONAL_ANNOUNCEMENT = 'I am happy to announce';
export const COMPANY_ANNOUNCEMENT = 'We are happy to announce';

export function normalizeIdeaFormat(value?: string | null): IdeaFormat {
  if (value === 'long' || value === 'one_long') {
    return 'long';
  }
  if (value === 'thread_short') {
    return 'thread_short';
  }
  if (value === 'thread_long') {
    return 'thread_long';
  }
  return 'short';
}

export function normalizeIdeaVoice(value?: string | null): IdeaVoice {
  return value === 'company' ? 'company' : 'personal';
}

export function announcement(voice: IdeaVoice): string {
  return voice === 'company' ? COMPANY_ANNOUNCEMENT : PERSONAL_ANNOUNCEMENT;
}

export function isThreadFormat(format: IdeaFormat): boolean {
  return format === 'thread_short' || format === 'thread_long';
}

export function postLimit(format: IdeaFormat, maxLength: number): number {
  const channel = !maxLength || maxLength < 1 ? 1000 : Math.floor(maxLength);
  if (format === 'short' || format === 'thread_short') {
    return Math.min(channel, SHORT_POST_CAP);
  }
  return channel;
}

function applyVoice(text: string, voice: IdeaVoice): string {
  const line = announcement(voice);
  const other = announcement(voice === 'company' ? 'personal' : 'company');
  const body = (text || '').replace(/\s+/g, ' ').trim();
  if (!body) {
    return line;
  }
  const lower = body.toLowerCase();
  if (lower.startsWith(line.toLowerCase())) {
    return `${line}${body.slice(line.length)}`.replace(/\s+/g, ' ').trim();
  }
  if (lower.startsWith(other.toLowerCase())) {
    return `${line}${body.slice(other.length)}`.replace(/\s+/g, ' ').trim();
  }
  return `${line} ${body}`;
}

function wordsWithin(text: string, limit: number): string[] {
  if (limit < 1) {
    return [];
  }
  const words = (text || '').split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const piece = word.length > limit ? word.slice(0, limit) : word;
    if (!current) {
      current = piece;
      continue;
    }
    if (`${current} ${piece}`.length <= limit) {
      current = `${current} ${piece}`;
      continue;
    }
    chunks.push(current);
    current = piece;
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function splitFitted(text: string): string[] {
  const clean = (text || '').trim();
  if (clean.length < 2) {
    return clean ? [clean] : [];
  }
  const midpoint = Math.floor(clean.length / 2);
  const space = clean.lastIndexOf(' ', midpoint);
  const cut = space > 0 ? space : midpoint;
  const first = clean.slice(0, cut).trim();
  const second = clean.slice(cut).trim();
  if (!first || !second) {
    return [clean];
  }
  return [first, second];
}

function threadPosts(text: string, voice: IdeaVoice, limit: number): string[] {
  const voiced = applyVoice(text, voice);
  const packed = wordsWithin(voiced, limit)
    .map((post) => clipPlain(post, limit))
    .filter(Boolean);
  if (packed.length >= 2) {
    return packed;
  }
  const line = announcement(voice);
  if (line.length < limit && voiced.toLowerCase().startsWith(line.toLowerCase())) {
    const rest = voiced.slice(line.length).trim();
    if (rest) {
      return [clipPlain(line, limit), clipPlain(rest, limit)].filter(Boolean);
    }
  }
  return splitFitted(packed[0] || clipPlain(voiced, limit))
    .map((post) => clipPlain(post, limit))
    .filter(Boolean);
}

function threadFromParts(parts: string[], voice: IdeaVoice, limit: number): string[] {
  const posts = parts.flatMap((part, index) =>
    wordsWithin(index === 0 ? applyVoice(part, voice) : part, limit)
  );
  if (posts.length >= 2) {
    return posts.map((post) => clipPlain(post, limit)).filter(Boolean);
  }
  return threadPosts(parts.join(' '), voice, limit);
}

// One post per channel, or several when the format is a thread and the
// channel publishes threads. Every post stays inside that channel's limit.
export function shapeChannelPosts(input: {
  text: string;
  format?: string | null;
  voice?: string | null;
  maxLength: number;
  supportsThread: boolean;
}): string[] {
  const format = normalizeIdeaFormat(input.format);
  const voice = normalizeIdeaVoice(input.voice);
  const limit = postLimit(format, input.maxLength);
  const parts = (input.text || '')
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!isThreadFormat(format) || !input.supportsThread) {
    const post = clipPlain(applyVoice(parts.join(' '), voice), limit);
    return post ? [post] : [];
  }
  if (parts.length > 1) {
    return threadFromParts(parts, voice, limit);
  }
  return threadPosts(parts[0] || '', voice, limit);
}

export function ideaPrompt(input: {
  source: string;
  channels: {
    id: string;
    name: string;
    provider: string;
    maxLength: number;
    style: string;
    supportsThread?: boolean;
  }[];
  voice?: string | null;
  format?: string | null;
  speaker?: string | null;
}): { system: string; user: string } {
  const format = normalizeIdeaFormat(input.format);
  const speaker = normalizeIdeaVoice(input.speaker);
  const line = announcement(speaker);
  const short = format === 'short' || format === 'thread_short';
  const thread = isThreadFormat(format);
  const brand = (input.voice || '').trim();
  const system = [
    'You draft social posts from a single idea, one draft per channel.',
    `Open every channel draft with "${line}".`,
    speaker === 'personal'
      ? 'Write in the first person, as the poster.'
      : 'Write in the first person plural, as the company.',
    short
      ? 'Write a short post. Stay at or under postLimit for that channel, and never over maxLength.'
      : 'Write a long post. Use the room up to postLimit, and never over maxLength.',
    thread
      ? 'When the channel says thread: yes, write several posts separated by a blank line. When it says thread: no, write one post.'
      : 'Write one post for each channel.',
    'Plain text only. No HTML, no markdown, no hashtags.',
    'Do not invent prices, quotes, or statistics that are not in the idea.',
    'Use the name crea8.one only when the idea is about that product.',
    brand ? `Write every draft in this brand voice:\n${brand.slice(0, 2000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const channels = input.channels
    .map((channel) => {
      const askThread = thread && !!channel.supportsThread;
      return [
        `- id: ${channel.id}`,
        `  name: ${channel.name}`,
        `  platform: ${channel.provider}`,
        `  maxLength: ${channel.maxLength}`,
        `  postLimit: ${postLimit(format, channel.maxLength)}`,
        `  thread: ${askThread ? 'yes' : 'no'}`,
        `  style: ${channel.style}`,
      ].join('\n');
    })
    .join('\n');

  return {
    system,
    user: `Idea:\n${input.source}\n\nChannels:\n${channels}\n\nReturn one entry per channel id. Use the id exactly. Put the post in content. For a thread, separate the posts with a blank line.`,
  };
}

export function readAdditionalSettings(raw?: string | null): any[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
