'use client';

import { withContinueProvider } from '../with-continue-provider';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

interface GmbItem {
  id: string;
  name: string;
  accountName: string;
  locationName: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface GmbSelection {
  id: string;
  accountName: string;
  locationName: string;
}

export const GmbContinue = withContinueProvider<GmbItem, GmbSelection>({
  endpoint: 'pages',
  swrKey: 'load-gmb-locations',
  titleKey: 'select_location',
  titleDefault: 'Select Business Location:',
  emptyStateMessages: [
    {
      key: 'gmb_no_locations_found',
      text: "We couldn't find any business locations connected to your account.",
    },
    {
      key: 'gmb_ensure_business_verified',
      text: 'Please ensure your business is verified on Google My Business.',
    },
    {
      key: 'gmb_try_again',
      text: 'Please close this dialog, delete the integration and try again.',
    },
  ],
  getItemId: (item) => item.id,
  getSelectionValue: (item) => ({
    id: item.id,
    accountName: item.accountName,
    locationName: item.locationName,
  }),
  transformSaveData: (selection) => selection,
  isSelected: (item, selection) => selection?.id === item.id,
  renderItem: (item) => (
    <>
      <div className="flex justify-center">
        {item.picture?.data?.url ? (
          <img
            className="w-[80px] h-[80px] object-cover rounded-[8px]"
            src={item.picture.data.url}
            alt={item.name}
          />
        ) : (
          <div className="w-[80px] h-[80px] bg-input rounded-[8px] flex items-center justify-center">
            <HugeIcon name="location" size={24} />
          </div>
        )}
      </div>
      <div className="text-sm font-medium">{item.name}</div>
    </>
  ),
});
