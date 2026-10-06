import { StalkerProjectRecord } from '@gitroom/frontend/components/stalker/stalker.project';

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const SAMPLE_PROJECTS: StalkerProjectRecord[] = [
  {
    id: 'sample-project',
    name: 'Crea8one test',
    description: 'test',
    color: '#71717a',
    brandName: 'Crea8one test',
    alertEmail: 'harshvwebsitedeveloper@gmail.com',
    digestEnabled: true,
    digestHour: 8,
    digestTimezone: 'Asia/Calcutta',
    digestGroupName: 'My brand',
    publicDashboard: false,
    publicToken: '',
    categories: [
      {
        id: 'cat-praise',
        name: 'Praise',
        description: 'Users expressing positive feedback about the product.',
      },
      {
        id: 'cat-bug',
        name: 'Bug report',
        description: 'Someone reporting something broken or not working.',
      },
      {
        id: 'cat-feature',
        name: 'Feature request',
        description: 'Someone asking for a new feature or improvement.',
      },
      {
        id: 'cat-complaint',
        name: 'Complaint',
        description: 'Negative feedback, frustration, or criticism about the product.',
      },
    ],
  },
  {
    id: 'sample-other',
    name: 'Crea8one test',
    description: 'test',
    color: '#477eeb',
  },
];

export const SAMPLE_STATUS = {
  pollHours: 6,
  maxKeywords: 10,
  openAi: true,
  ownerEmail: 'harshvwebsitedeveloper@gmail.com',
  emailCap: 3,
  sources: [
    {
      id: 'youtube',
      label: 'YouTube',
      filter: 'YOUTUBE',
      available: true,
      detail: 'Connected',
    },
    {
      id: 'x',
      label: 'X',
      filter: 'X',
      available: false,
      detail: 'Needs API access',
    },
    {
      id: 'reddit',
      label: 'Reddit',
      filter: 'REDDIT',
      available: false,
      detail: 'Needs API access',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      filter: 'LINKEDIN',
      available: false,
      detail: 'Coming soon',
    },
  ],
};

export const SAMPLE_GROUPS = [
  { id: 'group-brand', name: 'My brand', position: 0, _count: { keywords: 1 } },
  { id: 'group-comp', name: 'Competitors', position: 1, _count: { keywords: 0 } },
];

const spark = Array.from({ length: 30 }, (_, index) => (index > 24 ? index - 24 : 0));

export const SAMPLE_KEYWORDS = [
  {
    id: 'kw-canva',
    phrase: 'canva',
    listenYoutube: true,
    listenReddit: true,
    listenX: true,
    listenLinkedin: false,
    groupId: 'group-brand',
    group: { id: 'group-brand', name: 'My brand' },
    excludeAccounts: '',
    mentions30d: 8,
    sparkline: spark.map((value, index) => (index === 29 ? 8 : value)),
    lastScan: new Date().toISOString(),
    backfill: [] as Array<{ id: string; state: string; error?: string }>,
  },
];

export const SAMPLE_AUTHORS = [
  { authorName: 'wonyuk :p | joki edit canva, ...', authorHandle: 'jenoesle', source: 'X_POST', count: 1 },
  { authorName: 'fika', authorHandle: 'supncis', source: 'X_POST', count: 1 },
  { authorName: 'joey', authorHandle: 'JoeJcasorio', source: 'X_POST', count: 1 },
  { authorName: 'Daisy & Dots | App premium', authorHandle: 'strawberriesxx', source: 'X_POST', count: 1 },
  { authorName: 'BB@', authorHandle: 'guarddiant', source: 'X_POST', count: 1 },
];

const mention = (
  id: string,
  hours: number,
  authorName: string,
  authorHandle: string,
  text: string,
  extra: Record<string, unknown> = {}
) => ({
  id,
  createdAt: hoursAgo(hours),
  source: 'X_POST',
  authorName,
  authorHandle,
  text,
  url: `https://x.com/${authorHandle}/status/${id}`,
  likeCount: 12,
  replyCount: 2,
  sentiment: 'NEUTRAL',
  status: 'NEW',
  keyword: { phrase: 'canva' },
  categoryDef: null as { id: string; name: string } | null,
  ...extra,
});

export const SAMPLE_MENTIONS = {
  mentions: [
    mention(
      'm1',
      0.2,
      'wonyuk :p | joki edit canva, mt after dm pls!',
      'jenoesle',
      'selamat siang di hari selasa panas pukul 13.16 wib! Aku udah open kembali jasa joki edit canva tugas poster, banner, feeds, story, dkk! Fee mulai 5k aja udah free revisi dan pembayaran diakhir #zonauang #jokittugas #joktug https://example.com/joki'
    ),
    mention('m2', 1.2, 'fika', 'supncis', 'canva templates for class posters are finally easy to remix.', {
      sentiment: 'POSITIVE',
      categoryDef: { id: 'cat-praise', name: 'Praise' },
      likeCount: 40,
      replyCount: 3,
    }),
    mention('m3', 2.4, 'joey', 'JoeJcasorio', 'The canva export keeps failing on the last slide. Anyone else?', {
      sentiment: 'NEGATIVE',
      categoryDef: { id: 'cat-bug', name: 'Bug report' },
      likeCount: 18,
      replyCount: 6,
    }),
    mention('m4', 3.1, 'Daisy & Dots | App premium', 'strawberriesxx', 'Wish canva had a shared brand kit for classrooms.', {
      sentiment: 'NEUTRAL',
      categoryDef: { id: 'cat-feature', name: 'Feature request' },
    }),
    mention('m5', 4, 'BB@', 'guarddiant', 'canva watermark showed up after I paid. Frustrating.', {
      sentiment: 'NEGATIVE',
      categoryDef: { id: 'cat-complaint', name: 'Complaint' },
      likeCount: 22,
      replyCount: 4,
    }),
    mention('m6', 5.5, 'Nia', 'niaclass', 'Posted our science fair board made in canva. The kids loved it.', {
      sentiment: 'POSITIVE',
      categoryDef: { id: 'cat-praise', name: 'Praise' },
      source: 'YOUTUBE_COMMENT',
    }),
    mention('m7', 8, 'Raka', 'rakadesign', 'Looking for a canva alternative that keeps fonts offline.', {
      source: 'REDDIT_POST',
    }),
    mention('m8', 26, 'Mina', 'minaposter', 'Yesterday’s canva live was useful for banner sizes.', {
      sentiment: 'POSITIVE',
      categoryDef: { id: 'cat-praise', name: 'Praise' },
    }),
  ],
  nextCursor: null as string | null,
};

const series = Array.from({ length: 30 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - index));
  const count = index === 29 ? 8 : 0;
  return {
    date: date.toISOString().slice(0, 10),
    positive: index === 29 ? 3 : 0,
    negative: index === 29 ? 2 : 0,
    neutral: index === 29 ? 3 : 0,
    count,
  };
});

export const SAMPLE_ANALYTICS = {
  totals: { mentions: 8, positive: 3, negative: 2, neutral: 3 },
  avgPerDay: 0.3,
  series,
  overTime: series.map((row) => ({ date: row.date, count: row.count })),
  bySource: [
    { source: 'X_POST', count: 6 },
    { source: 'YOUTUBE_COMMENT', count: 1 },
    { source: 'REDDIT_POST', count: 1 },
  ],
  byCategory: [
    { categoryId: 'cat-praise', name: 'Praise', count: 3 },
    { categoryId: 'cat-bug', name: 'Bug report', count: 1 },
    { categoryId: 'cat-feature', name: 'Feature request', count: 1 },
    { categoryId: 'cat-complaint', name: 'Complaint', count: 1 },
    { categoryId: null, name: 'Uncategorized', count: 2 },
  ],
  byKeyword: [{ keywordId: 'kw-canva', phrase: 'canva', count: 8 }],
  accounts: [
    { authorName: 'wonyuk :p | joki edit canva, mt after dm pls!', count: 1 },
    { authorName: 'fika', count: 1 },
    { authorName: 'joey', count: 1 },
    { authorName: 'Daisy & Dots | App premium', count: 1 },
  ],
  supporters: [
    { authorName: 'fika', count: 1 },
    { authorName: 'Nia', count: 1 },
    { authorName: 'Mina', count: 1 },
  ],
  critics: [
    { authorName: 'joey', count: 1 },
    { authorName: 'BB@', count: 1 },
  ],
  heatmap: Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => (day === 1 && hour === 11 ? 4 : hour === 15 && day === 1 ? 2 : 0))
  ),
};

export const SAMPLE_RULES = [
  {
    id: 'rule-1',
    name: 'Negative X posts with traction',
    enabled: true,
    filters: { sources: 'X', sentiment: 'NEGATIVE', engagement: 'X:10' },
  },
];

export const SAMPLE_VIEWS = [
  {
    id: 'view-1',
    name: 'Negative X',
    filters: { sources: 'X', sentiment: 'NEGATIVE' },
  },
];
