import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Dummy incremental cache (the adapter default). This app has no page ISR.
// Public Link-in-Bio fetch caching is turned off on the Worker with
// PUBLIC_LINK_CACHE_SECONDS=0. Vercel does not read this file.
export default defineCloudflareConfig();
