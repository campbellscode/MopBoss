import { GalleryPage } from '@/components/gallery/GalleryPage';
import { PageShell } from '@/components/layout/PageShell';

export default function Page() {
  return (
    <PageShell page="gallery">
      <GalleryPage />
    </PageShell>
  );
}
