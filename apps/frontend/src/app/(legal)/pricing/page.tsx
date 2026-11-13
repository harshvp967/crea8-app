import { PublicPricing } from '@gitroom/frontend/components/billing/public.pricing';
import '../../c8-link.scss';
import '../../c8-settings.scss';
import { legalPageMetadata } from '@gitroom/frontend/components/layout/site.metadata';

export const metadata = legalPageMetadata('Pricing', '/pricing');

export default function PricingPage() {
  return <PublicPricing />;
}
