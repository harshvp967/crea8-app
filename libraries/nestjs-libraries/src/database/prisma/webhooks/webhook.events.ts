// Workspace webhook events. Schedule names are the ones existing rows receive.
// Stalker and Link in Bio are opt-in. A row that only has the Schedule pair
// does not get those calls.

export const WEBHOOK_EVENT = {
  postPublished: 'post.published',
  postFailed: 'post.failed',
  stalkerMatch: 'stalker.match',
  linkClick: 'link.click',
  linkSubmission: 'link.submission',
} as const;

export type WebhookEventName = (typeof WEBHOOK_EVENT)[keyof typeof WEBHOOK_EVENT];

export type ScheduleWebhookEvent =
  | typeof WEBHOOK_EVENT.postPublished
  | typeof WEBHOOK_EVENT.postFailed;

export const WEBHOOK_EVENTS: WebhookEventName[] = [
  WEBHOOK_EVENT.postPublished,
  WEBHOOK_EVENT.postFailed,
  WEBHOOK_EVENT.stalkerMatch,
  WEBHOOK_EVENT.linkClick,
  WEBHOOK_EVENT.linkSubmission,
];

// Column default on Webhooks.events. Keep this identical to schema.prisma.
export const SCHEDULE_WEBHOOK_EVENTS: ScheduleWebhookEvent[] = [
  WEBHOOK_EVENT.postPublished,
  WEBHOOK_EVENT.postFailed,
];

export function isWebhookEvent(value: string): value is WebhookEventName {
  return (WEBHOOK_EVENTS as string[]).includes(value);
}

export function isScheduleWebhookEvent(value: string): value is ScheduleWebhookEvent {
  return (
    value === WEBHOOK_EVENT.postPublished || value === WEBHOOK_EVENT.postFailed
  );
}

// Unknown names are dropped. Order follows WEBHOOK_EVENTS so storage is stable.
export function normalizeWebhookEvents(events: readonly string[]): WebhookEventName[] {
  const seen = new Set<string>(events);
  return WEBHOOK_EVENTS.filter((event) => seen.has(event));
}

// Omit the column when the client did not send events. Create then uses the
// database default (both Schedule events). Update leaves the stored selection.
export function webhookEventsWrite(events: readonly string[] | null | undefined) {
  if (events == null) {
    return {};
  }
  return { events: normalizeWebhookEvents(events) };
}

// A missing value is a row from before the column existed. An empty array is
// an explicit selection of nothing.
export function eventsOrScheduleDefault(
  events: readonly string[] | null | undefined
): WebhookEventName[] {
  if (events == null) {
    return [...SCHEDULE_WEBHOOK_EVENTS];
  }
  return normalizeWebhookEvents(events);
}

export function webhookMatchesIntegration(
  integrations: { integration: { id: string } }[],
  integrationId: string
) {
  return (
    integrations.length === 0 ||
    integrations.some((item) => item.integration.id === integrationId)
  );
}
