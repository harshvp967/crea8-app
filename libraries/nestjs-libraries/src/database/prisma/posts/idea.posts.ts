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

export function ideaPrompt(input: {
  source: string;
  channels: {
    id: string;
    name: string;
    provider: string;
    maxLength: number;
    style: string;
  }[];
  voice?: string | null;
}): { system: string; user: string } {
  const voice = (input.voice || '').trim();
  const system = [
    'You draft one social post per channel from a single idea.',
    'Each post stands alone and matches that platform length and style.',
    'Stay at or under maxLength characters. Plain text only. No HTML, no markdown.',
    'Do not invent prices, quotes, or statistics that are not in the idea.',
    'Use the name crea8.one only when the idea is about that product.',
    voice
      ? `Write every draft in this brand voice:\n${voice.slice(0, 2000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const channels = input.channels
    .map(
      (channel) =>
        `- id: ${channel.id}\n  name: ${channel.name}\n  platform: ${channel.provider}\n  maxLength: ${channel.maxLength}\n  style: ${channel.style}`
    )
    .join('\n');

  return {
    system,
    user: `Idea:\n${input.source}\n\nChannels:\n${channels}\n\nReturn one post per channel id. Use the id exactly.`,
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
