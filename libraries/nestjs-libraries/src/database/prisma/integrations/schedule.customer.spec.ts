import {
  composerChannels,
  customerFilterValue,
  integrationsForCustomer,
  namedCustomers,
  CustomerChannel,
} from '@gitroom/frontend/components/launches/customer.filter';

const channel = (
  id: string,
  customer?: { id: string; name: string }
): CustomerChannel => ({
  id,
  customer,
});

const catalog = [
  channel('x', { id: 'cust-a', name: 'Acme' }),
  channel('y', { id: 'cust-b', name: 'Beta' }),
  channel('z'),
];

describe('schedule customer filter', () => {
  it('treats an empty selection as all customers', () => {
    expect(customerFilterValue('')).toBeNull();
    expect(customerFilterValue(null)).toBeNull();
    expect(customerFilterValue('cust-a')).toBe('cust-a');
  });

  it('hides the selector when no channel belongs to a named customer', () => {
    expect(namedCustomers([channel('z'), channel('q')])).toEqual([]);
    expect(namedCustomers([])).toEqual([]);
    expect(namedCustomers(catalog).map((item) => item.customer?.id)).toEqual([
      'cust-a',
      'cust-b',
    ]);
  });

  it('keeps every channel for all customers and one customer otherwise', () => {
    expect(integrationsForCustomer(catalog, null).map((item) => item.id)).toEqual([
      'x',
      'y',
      'z',
    ]);
    expect(integrationsForCustomer(catalog, '').map((item) => item.id)).toEqual([
      'x',
      'y',
      'z',
    ]);
    expect(
      integrationsForCustomer(catalog, 'cust-a').map((item) => item.id)
    ).toEqual(['x']);
  });

  it('does not let a slot post decide which channels the composer offers', () => {
    const opened = composerChannels({
      catalog,
      slotIntegrations: [catalog[0]],
      customer: null,
    });
    expect(opened.allIntegrations.map((item) => item.id)).toEqual([
      'x',
      'y',
      'z',
    ]);
    expect(opened.selectedChannels).toBeUndefined();
  });

  it('preselects the chosen customer and still offers every channel', () => {
    const opened = composerChannels({
      catalog,
      slotIntegrations: [catalog[0]],
      customer: 'cust-b',
    });
    expect(opened.allIntegrations.map((item) => item.id)).toEqual([
      'x',
      'y',
      'z',
    ]);
    expect(opened.selectedChannels).toEqual(['y']);
  });

  it('keeps an explicit channel when the menu opens the composer for one', () => {
    const opened = composerChannels({
      catalog,
      customer: 'cust-b',
      presetChannelIds: ['x'],
    });
    expect(opened.selectedChannels).toEqual(['x']);
    expect(opened.allIntegrations).toHaveLength(3);
  });
});
