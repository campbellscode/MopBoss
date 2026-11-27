import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BossButton, BossLink } from './Button';
import { Magnetic, magneticOffset } from './Magnetic';
import { SectionHeading } from './Type';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SectionHeading', () => {
  it('renders plain text and the italic accent phrase in one heading', () => {
    render(<SectionHeading parts={['Pick your ', { accent: 'kind' }, ' of clean.']} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Pick your kind of clean.');
    expect(heading.querySelector('.accent')).toHaveTextContent('kind');
  });
});

describe('Boss buttons', () => {
  it('renders a link for internal routes', () => {
    render(<BossLink href="/quote">Get a quote</BossLink>);
    expect(screen.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/quote');
  });

  it('defaults button type to "button" so it never submits a form by accident', () => {
    render(<BossButton>Continue</BossButton>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
  });
});

describe('Magnetic (the Boss Treatment)', () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 } as DOMRect;

  it('pulls x by 0.22 and y by 0.34 of the offset from centre', () => {
    expect(magneticOffset(rect, 200, 100)).toEqual({ x: 22, y: 17 });
    expect(magneticOffset(rect, 100, 50)).toEqual({ x: 0, y: 0 });
  });

  function setup() {
    render(
      <Magnetic>
        <BossLink href="/quote">Go</BossLink>
      </Magnetic>,
    );
    const link = screen.getByRole('link', { name: 'Go' });
    const halo = link.parentElement as HTMLElement;
    halo.getBoundingClientRect = () => rect;
    return { link, halo };
  }

  it('moves the button toward the cursor and resets on leave', () => {
    mockReducedMotion(false);
    const { link, halo } = setup();
    fireEvent.mouseMove(halo, { clientX: 200, clientY: 100 });
    expect(link.style.transform).toBe('translate(22px, 17px)');
    fireEvent.mouseLeave(halo);
    expect(link.style.transform).toBe('');
  });

  it('stays still when reduced motion is requested', () => {
    mockReducedMotion(true);
    const { link, halo } = setup();
    fireEvent.mouseMove(halo, { clientX: 200, clientY: 100 });
    expect(link.style.transform).toBe('');
  });
});
