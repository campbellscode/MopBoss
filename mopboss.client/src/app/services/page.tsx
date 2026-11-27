import { pageMetadata } from '@/lib/metadata';
import { PageShell } from '@/components/layout/PageShell';
import { ServicesPage } from '@/components/services/ServicesPage';

export const metadata = pageMetadata('services', '/services');

export default function Page() {
  return (
    <PageShell page="services">
      <ServicesPage />
    </PageShell>
  );
}
