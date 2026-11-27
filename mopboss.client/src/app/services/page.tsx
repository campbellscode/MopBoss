import { PageShell } from '@/components/layout/PageShell';
import { ServicesPage } from '@/components/services/ServicesPage';

export default function Page() {
  return (
    <PageShell page="services">
      <ServicesPage />
    </PageShell>
  );
}
