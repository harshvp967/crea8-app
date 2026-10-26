export type AgentChannelRef = {
  id: string;
  identifier: string;
  picture?: string | null;
  additionalSettings?: string | null;
};

// The Channels panel unmounts when it closes. Selection has to live in the
// returned list, which the Agent page keeps and the chat sends.
export function toggleChannelSelection<T extends { id: string }>(
  selected: readonly T[],
  channel: T
): T[] {
  if (selected.some((item) => item.id === channel.id)) {
    return selected.filter((item) => item.id !== channel.id);
  }
  return [...selected, channel];
}

export function agentIntegrationsBlock(
  selected: readonly AgentChannelRef[]
): string {
  if (!selected.length) {
    return '';
  }
  return `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
    selected.map((channel) => ({
      id: channel.id,
      platform: channel.identifier,
      profilePicture: channel.picture,
      additionalSettings: channel.additionalSettings,
    }))
  )}
[--integrations--]`;
}
