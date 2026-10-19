export type LearnedVoice = {
  traits: string[];
  sample: string;
  count: number;
  learnedAt: string;
};

export function parseVoice(raw?: string | null): LearnedVoice | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.traits)) {
      return null;
    }
    const traits = parsed.traits
      .filter((item: unknown) => typeof item === 'string' && item.trim())
      .map((item: string) => item.trim())
      .slice(0, 6);
    if (!traits.length) {
      return null;
    }
    return {
      traits,
      sample: typeof parsed.sample === 'string' ? parsed.sample.trim() : '',
      count: Number(parsed.count) || 0,
      learnedAt: typeof parsed.learnedAt === 'string' ? parsed.learnedAt : '',
    };
  } catch {
    return null;
  }
}

export function voiceForPrompt(raw?: string | null): string | null {
  const learned = parseVoice(raw);
  if (learned) {
    const sample = learned.sample ? ` Sample: ${learned.sample}` : '';
    return `${learned.traits.join(', ')}.${sample}`;
  }
  const plain = (raw || '').trim();
  return plain || null;
}

export function activeVoice(
  profile?: { enabled?: boolean; traits?: string | null } | null
): string | null {
  if (!profile?.enabled) {
    return null;
  }
  return voiceForPrompt(profile.traits);
}

export function cleanSamples(samples: string[]): string[] {
  return (samples || []).map((sample) => sample.trim()).filter(Boolean);
}
