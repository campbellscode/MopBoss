import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/content/audit');
});

async function renderGallery(audit: boolean) {
  vi.doMock('@/content/audit', () => ({ contentAudit: audit }));
  const { GalleryPage } = await import('./GalleryPage');
  return render(<GalleryPage />);
}

describe('GalleryPage', () => {
  it('shows only the labelled demo and the CTA while there are no real photos', async () => {
    await renderGallery(false);
    expect(screen.getByRole('slider', { name: /before and after reveal/i })).toBeInTheDocument();
    expect(screen.getByText('Illustrated demo, not a real job')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /room by room/i })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filter by room' })).toBeNull();
  });

  it('shows the placeholder wall with working room filters in audit mode', async () => {
    const user = userEvent.setup();
    await renderGallery(true);
    expect(screen.getByRole('heading', { name: /room by room/i })).toBeInTheDocument();
    const filters = screen.getByRole('group', { name: 'Filter by room' });
    const wall = screen.getByRole('heading', { name: /room by room/i }).closest('section')!;
    expect(within(wall).getAllByRole('figure')).toHaveLength(6);

    await user.click(within(filters).getByRole('button', { name: 'Kitchens' }));
    expect(within(filters).getByRole('button', { name: 'Kitchens' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(wall).getAllByRole('figure')).toHaveLength(2);
  });
});
