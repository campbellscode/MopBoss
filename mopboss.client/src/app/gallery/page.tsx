import { pageMetadata } from '@/lib/metadata';
import { GalleryPage } from '@/components/gallery/GalleryPage';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = pageMetadata('gallery', '/gallery');

export default function Page() {
  return (
    <PageShell page="gallery">
      <GalleryPage />
    </PageShell>
  );
}
