import { Metadata } from 'next';
import { PublicPricing } from '@gitroom/frontend/components/billing/public.pricing';
import '../../c8-link.scss';
import '../../c8-settings.scss';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'crea8.one plans in USD. Tax is added at checkout.',
};

export default function PricingPage() {
  return <PublicPricing />;
}
