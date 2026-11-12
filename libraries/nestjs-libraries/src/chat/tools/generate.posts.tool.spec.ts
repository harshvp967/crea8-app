import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts.service',
  () => ({
    IdeaPostsService: class IdeaPostsService {},
  })
);

import { GeneratePostsTool } from '@gitroom/nestjs-libraries/chat/tools/generate.posts.tool';

const run = async (tool: { run: () => any }, input: unknown) => {
  const built = tool.run();
  const store = new Map<string, string>([
    ['organization', JSON.stringify({ id: 'org-1' })],
  ]);
  return built.execute(input, {
    requestContext: {
      get: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
    },
  });
};

describe('generate posts MCP tool', () => {
  const source = readFileSync(join(__dirname, 'generate.posts.tool.ts'), 'utf8');

  it('registers generatePostsTool with format and voice', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    expect(list).toContain('GeneratePostsTool');
    expect(new GeneratePostsTool({} as any).name).toBe('generatePostsTool');
    expect(source).toContain("enum(['short', 'long', 'thread_short', 'thread_long'])");
    expect(source).toContain("enum(['personal', 'company'])");
    expect(source).toContain('I am happy to announce');
    expect(source).toContain('We are happy to announce');
  });

  it('forwards format and voice into the same generate call', async () => {
    const ideaPosts = {
      generate: jest.fn().mockResolvedValue({
        voice: false,
        drafts: [
          {
            integrationId: 'ch-x',
            provider: 'x',
            name: 'News',
            picture: null,
            content: 'We are happy to announce\n\nThe update is live.',
            posts: ['We are happy to announce', 'The update is live.'],
            publishAt: '2026-11-13T15:00:00',
            settings: {},
            maxLength: 280,
          },
        ],
      }),
    };
    const result = await run(new GeneratePostsTool(ideaPosts as any), {
      idea: 'ship the update',
      format: 'thread_short',
      voice: 'company',
      customer: 'customer-1',
    });
    expect(ideaPosts.generate).toHaveBeenCalledTimes(1);
    expect(ideaPosts.generate).toHaveBeenCalledWith(
      { id: 'org-1' },
      {
        idea: 'ship the update',
        customer: 'customer-1',
        format: 'thread_short',
        voice: 'company',
      }
    );
    expect(result.drafts[0].posts).toEqual([
      'We are happy to announce',
      'The update is live.',
    ]);
  });

  it('omits format and voice so generation keeps its defaults', async () => {
    const ideaPosts = {
      generate: jest.fn().mockResolvedValue({ voice: false, drafts: [] }),
    };
    await run(new GeneratePostsTool(ideaPosts as any), { idea: 'ship the update' });
    expect(ideaPosts.generate).toHaveBeenCalledWith(
      { id: 'org-1' },
      { idea: 'ship the update' }
    );
  });

  it('returns the existing credit and plan errors without another charge', async () => {
    const ideaPosts = {
      generate: jest
        .fn()
        .mockResolvedValueOnce({ error: 'You are out of credits. Upgrade your plan.' })
        .mockRejectedValueOnce(new ForbiddenException('Not available')),
    };
    const tool = new GeneratePostsTool(ideaPosts as any);
    const poor = await run(tool, {
      idea: 'ship the update',
      format: 'long',
      voice: 'personal',
    });
    expect(poor.error).toMatch(/out of credits/i);
    const refused = await run(tool, {
      idea: 'ship the update',
      format: 'thread_long',
      voice: 'company',
    });
    expect(refused.error).toBe('Not available');
    expect(ideaPosts.generate).toHaveBeenCalledTimes(2);
  });
});
