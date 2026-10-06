import {
  decodeHtmlEntities,
  normalizeHandle,
} from '@gitroom/helpers/utils/stalker.text';

describe('stalker text helpers', () => {
  it('decodes named, numeric and double-encoded entities to plain text', () => {
    expect(decodeHtmlEntities('Canva &amp; Figma')).toBe('Canva & Figma');
    expect(decodeHtmlEntities('Tom &amp;amp; Jerry&#39;s &#x1F600; &quot;hi&quot;')).toBe(
      'Tom & Jerry\'s 😀 "hi"'
    );
    expect(decodeHtmlEntities('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
    expect(decodeHtmlEntities('AT&T and &unknown; stay')).toBe('AT&T and &unknown; stay');
    expect(decodeHtmlEntities(undefined)).toBe('');
  });

  it('strips any leading @ from handles', () => {
    expect(normalizeHandle('@@ada')).toBe('ada');
    expect(normalizeHandle(' @ada ')).toBe('ada');
    expect(normalizeHandle('ada')).toBe('ada');
    expect(normalizeHandle('')).toBe('');
  });
});

describe('insertMentions stores plain text', () => {
  it('decodes entities and strips a leading @ before saving', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StalkerRepository } = require('@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository');
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const model = {
      stalkerMention: { findMany: jest.fn().mockResolvedValue([]), createMany },
    };
    const wrap = { model } as never;
    const repo = new StalkerRepository(...Array.from({ length: 15 }, () => wrap));
    await repo.insertMentions(
      'org',
      'proj',
      null,
      [
        {
          externalId: 'yt-video:1',
          source: 'YOUTUBE_SEARCH',
          authorName: 'Tom &amp; Jerry',
          authorHandle: '@tomjerry',
          text: 'Canva &amp;amp; Figma &#39;25',
          url: 'https://www.youtube.com/watch?v=1',
        },
      ],
      new Map()
    );
    const row = createMany.mock.calls[0][0].data[0];
    expect(row.authorName).toBe('Tom & Jerry');
    expect(row.authorHandle).toBe('tomjerry');
    expect(row.text).toBe("Canva & Figma '25");
  });
});
