// One comma-separated list of organization ids. Empty (the default) means the
// one-idea drafts and brand voice stay off for every organization.
export function aiDraftsOrgAllowlist(
  raw = process.env.AI_DRAFTS_ORG_IDS
): string[] {
  return (raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function aiDraftsEnabledForOrg(
  orgId?: string | null,
  raw = process.env.AI_DRAFTS_ORG_IDS
): boolean {
  if (!orgId) {
    return false;
  }
  return aiDraftsOrgAllowlist(raw).includes(orgId);
}
