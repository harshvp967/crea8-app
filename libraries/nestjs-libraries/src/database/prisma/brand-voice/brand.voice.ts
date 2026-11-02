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

export const BRAND_VOICE_REQUIRED = 3;
export const BRAND_VOICE_LIMIT = 5;

export function voicePostsReady(count: number) {
  return count >= BRAND_VOICE_REQUIRED && count <= BRAND_VOICE_LIMIT;
}

export function voiceCounterLabel(count: number) {
  const shown = Math.max(0, Math.min(Math.trunc(count) || 0, BRAND_VOICE_LIMIT));
  return `${shown} of ${BRAND_VOICE_LIMIT} added`;
}

// The counter is "0 of 5". The help must use that same 5, not "Paste 3 to 5".
export function voiceHelpCopy() {
  return 'Paste posts you wrote yourself, up to 5. We only read them to learn how you write, and never publish them.';
}
