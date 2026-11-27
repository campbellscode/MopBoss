import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/content/audit');
});

async function load(audit: boolean) {
  vi.doMock('@/content/audit', () => ({ contentAudit: audit }));
  return import('./Placeholder');
}

describe('placeholders', () => {
  it('render nothing in production builds', async () => {
    const { PlaceholderChip, PlaceholderNote, AuditOnly } = await load(false);
    const { container } = render(
      <>
        <PlaceholderChip>[Email]</PlaceholderChip>
        <PlaceholderNote title="[NOTE]">Body</PlaceholderNote>
        <AuditOnly>prototype note</AuditOnly>
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('render the gold chips in content-audit mode', async () => {
    const { PlaceholderChip, PlaceholderNote } = await load(true);
    render(
      <>
        <PlaceholderChip>[Email]</PlaceholderChip>
        <PlaceholderNote title="[NOTE]">Body</PlaceholderNote>
      </>,
    );
    expect(screen.getByText('[Email]')).toHaveAttribute('data-placeholder');
    expect(screen.getByText('[NOTE]')).toBeInTheDocument();
  });
});
