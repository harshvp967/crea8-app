import { uniqBy } from 'lodash';

export type CustomerChannel = {
  id: string;
  customer?: {
    id?: string;
    name?: string;
  } | null;
};

// Channels that belong to a named customer. Unassigned channels do not count,
// so the selector stays hidden until a customer actually exists.
export function namedCustomers<T extends CustomerChannel>(integrations: T[]): T[] {
  return uniqBy(integrations, (item) => item?.customer?.name).filter(
    (item): item is T & { customer: { id: string; name: string } } =>
      !!item.customer?.id && !!item.customer?.name
  );
}

// Empty means every customer. The schedule selector stores that as null.
export function customerFilterValue(customer?: string | null): string | null {
  return customer || null;
}

export function integrationsForCustomer<T extends CustomerChannel>(
  integrations: T[],
  customer?: string | null
): T[] {
  const selected = customerFilterValue(customer);
  if (!selected) {
    return integrations;
  }
  return integrations.filter((item) => item.customer?.id === selected);
}

// The day-view slot replaces the calendar's channel list with the channels
// that already have a post or a time in that row. The composer must ignore
// that list: every channel stays available, and a selected customer only
// decides which of them start selected.
export function composerChannels<T extends CustomerChannel>(input: {
  catalog: T[];
  slotIntegrations?: T[];
  customer?: string | null;
  presetChannelIds?: string[];
}): { allIntegrations: T[]; selectedChannels?: string[] } {
  const catalog = input.catalog;
  if (input.presetChannelIds?.length) {
    return {
      allIntegrations: catalog,
      selectedChannels: input.presetChannelIds,
    };
  }
  const selected = customerFilterValue(input.customer);
  if (!selected) {
    return { allIntegrations: catalog };
  }
  const selectedChannels = integrationsForCustomer(catalog, selected).map(
    (item) => item.id
  );
  if (!selectedChannels.length) {
    return { allIntegrations: catalog };
  }
  return { allIntegrations: catalog, selectedChannels };
}
