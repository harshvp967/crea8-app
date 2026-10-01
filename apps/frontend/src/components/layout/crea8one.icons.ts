import type { Metadata } from 'next';

// New paths on purpose. /favicon.ico is the old Postiz URL browsers have cached,
// and a query string on that same path is dropped when Next hydrates metadata.
export const crea8oneIcons: Metadata['icons'] = {
  icon: [
    {
      url: '/crea8one-favicon.svg',
      type: 'image/svg+xml',
    },
    {
      url: '/crea8one-favicon-32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      url: '/crea8one-favicon.ico',
      type: 'image/x-icon',
    },
  ],
  apple: [
    {
      url: '/crea8one-apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  ],
};
