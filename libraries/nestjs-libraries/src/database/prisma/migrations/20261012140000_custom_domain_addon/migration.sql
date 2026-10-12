-- Custom domains are an organization add-on, separate from the subscription plan.
-- Additive. Existing organizations stay false, so a paid plan does not gain a domain.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customDomainAddon" BOOLEAN NOT NULL DEFAULT false;
