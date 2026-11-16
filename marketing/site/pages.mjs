import { readFileSync } from 'node:fs';
import { dataDeletion, privacy, refunds, terms } from './legal.mjs';
import { PAGE_PATHS } from './paths.mjs';

function body(name) {
  return readFileSync(new URL(`./bodies/${name}.html`, import.meta.url), 'utf8');
}

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

export const pages = [
  { path: '/', title: 'crea8.one', file: 'index.html', main: body('home') },
  { path: '/schedule', title: 'Schedule', file: 'schedule/index.html', main: body('schedule') },
  { path: '/link', title: 'Link in Bio', file: 'link/index.html', main: body('link') },
  { path: '/stalker', title: 'Stalker', file: 'stalker/index.html', main: body('stalker') },
  { path: '/channels', title: 'Channels', file: 'channels/index.html', main: body('channels') },
  { path: '/pricing', title: 'Pricing', file: 'pricing/index.html', main: body('pricing') },
  { path: '/agent', title: 'Agent', file: 'agent/index.html', main: body('agent') },
  { path: '/mcp', title: 'MCP', file: 'mcp/index.html', main: body('mcp') },
  { path: '/chatgpt', title: 'ChatGPT', file: 'chatgpt/index.html', main: body('chatgpt') },
  { path: '/claude', title: 'Claude', file: 'claude/index.html', main: body('claude') },
  { path: '/claude-code', title: 'Claude Code', file: 'claude-code/index.html', main: body('claude-code') },
  { path: '/cursor', title: 'Cursor', file: 'cursor/index.html', main: body('cursor') },
  { path: '/grok-bot', title: 'Grok Bot', file: 'grok-bot/index.html', main: body('grok-bot') },
  { path: '/cli', title: 'CLI', file: 'cli/index.html', main: body('cli') },
  { path: '/about', title: 'About', file: 'about/index.html', main: body('about') },
  { path: '/contact', title: 'Contact', file: 'contact/index.html', main: body('contact') },
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
  { path: '/404', title: '404', file: '404.html', main: body('404') },
];

export const REQUIRED_PATHS = PAGE_PATHS;
