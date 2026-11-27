import { pageMetadata } from '@/lib/metadata';
import { QuoteFlow } from '@/components/quote/QuoteFlow';

export const metadata = pageMetadata('quote', '/quote');

export default function QuotePage() {
  return <QuoteFlow />;
}
