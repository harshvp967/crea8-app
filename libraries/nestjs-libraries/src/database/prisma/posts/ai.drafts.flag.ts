// One comma-separated list of organization ids. A trimmed `*` entry turns
// one-idea drafts and brand voice on for every organization. Empty (the
// default) means they stay off.
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
  const allowlist = aiDraftsOrgAllowlist(raw);
  if (allowlist.includes('*')) {
    return true;
  }
  return allowlist.includes(orgId);
}
