// Placeholder monthly caps for one-idea drafts. Change the numbers here.
export const aiPostGenerationLimits: Record<string, number> = {
  FREE: 1000,
  STANDARD: 80,
  TEAM: 200,
  PRO: 400,
  ULTIMATE: 1000,
};

export function limitForTier(tier?: string | null): number {
  if (!tier) {
    return aiPostGenerationLimits.FREE;
  }
  return aiPostGenerationLimits[tier] ?? aiPostGenerationLimits.FREE;
}

export function upgradeMessage(used: number, limit: number): string {
  return `You've used ${used} of ${limit} AI posts this month. Upgrade crea8.one to draft more.`;
}
