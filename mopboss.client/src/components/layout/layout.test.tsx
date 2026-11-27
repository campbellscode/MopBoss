import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('provides a skip link, landmarks and the confirmed phone number', () => {
    render(
      <PageShell page="services">
        <h1>Services</h1>
      </PageShell>,
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('link', { name: /\(513\) 319-4988/ })[0]).toHaveAttribute(
      'href',
      'tel:+15133194988',
    );
  });

  it('shows no placeholder brackets in a production build', () => {
    const { container } = render(
      <PageShell page="home">
        <h1>Home</h1>
      </PageShell>,
    );
    expect(container.textContent).not.toMatch(/\[|\]/);
    expect(container.querySelector('[data-placeholder]')).toBeNull();
  });

  it('adds the thumb bar only on the homepage', () => {
    const { unmount } = render(
      <PageShell page="home">
        <h1>Home</h1>
      </PageShell>,
    );
    expect(screen.getByRole('navigation', { name: 'Quick navigation' })).toBeInTheDocument();
    unmount();
    render(
      <PageShell page="about">
        <h1>About</h1>
      </PageShell>,
    );
    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).toBeNull();
  });
});
