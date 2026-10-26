import {
  agentIntegrationsBlock,
  toggleChannelSelection,
} from '@gitroom/frontend/components/agents/agent.channels';

const x = {
  id: 'x',
  identifier: 'x',
  picture: 'https://cdn.example/x.png',
  additionalSettings: '[]',
};
const linkedin = {
  id: 'li',
  identifier: 'linkedin',
  picture: 'https://cdn.example/li.png',
  additionalSettings: '{"type":"page"}',
};

describe('agent channel selection', () => {
  it('keeps every selected channel until that channel is toggled off', () => {
    const first = toggleChannelSelection([], x);
    const both = toggleChannelSelection(first, linkedin);
    const withoutX = toggleChannelSelection(both, x);

    expect(first.map((channel) => channel.id)).toEqual(['x']);
    expect(both.map((channel) => channel.id)).toEqual(['x', 'li']);
    expect(withoutX).toEqual([linkedin]);
    expect(toggleChannelSelection(withoutX, linkedin)).toEqual([]);
    expect(toggleChannelSelection(both, linkedin).map((channel) => channel.id)).toEqual([
      'x',
    ]);
  });

  it('sends the persisted selection as the agent integration block', () => {
    const selected = toggleChannelSelection(toggleChannelSelection([], x), linkedin);

    expect(agentIntegrationsBlock([])).toBe('');
    expect(agentIntegrationsBlock(selected)).toBe(`[--integrations--]
Use the following social media platforms: ${JSON.stringify([
      {
        id: 'x',
        platform: 'x',
        profilePicture: 'https://cdn.example/x.png',
        additionalSettings: '[]',
      },
      {
        id: 'li',
        platform: 'linkedin',
        profilePicture: 'https://cdn.example/li.png',
        additionalSettings: '{"type":"page"}',
      },
    ])}
[--integrations--]`);
    expect(agentIntegrationsBlock(toggleChannelSelection(selected, x))).toBe(
      agentIntegrationsBlock([linkedin])
    );
  });
});
