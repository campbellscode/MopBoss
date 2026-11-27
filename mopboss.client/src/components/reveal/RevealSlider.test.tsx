import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevealSlider, SWEEP_MS, easeOutCubic } from './RevealSlider';

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

const sweep = {
  buttonLabel: 'Sweep it for me',
  statusFormat: '{pct}% spotless',
};

function setup(withSweep = false) {
  render(<RevealSlider variant="gallery" initial={38} sweep={withSweep ? sweep : undefined} />);
  const range = screen.getByRole('slider', { name: /before and after reveal/i });
  const frame = range.parentElement as HTMLElement;
  return { range, frame };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RevealSlider (the Transformation Reveal)', () => {
  it('is a labelled native range input starting at the initial position', () => {
    const { range, frame } = setup();
    expect(range).toHaveAttribute('type', 'range');
    expect(range).toHaveValue('38');
    expect(frame.style.getPropertyValue('--p')).toBe('38%');
  });

  it('moves the wipe through the --p variable when the value changes (drag, tap or keys)', () => {
    const { range, frame } = setup();
    fireEvent.change(range, { target: { value: '72' } });
    expect(frame.style.getPropertyValue('--p')).toBe('72%');
  });

  it('jumps straight to 100% when reduced motion is requested', () => {
    mockReducedMotion(true);
    const { range, frame } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sweep it for me' }));
    expect(frame.style.getPropertyValue('--p')).toBe('100%');
    expect(range).toHaveValue('100');
    expect(screen.getByRole('status')).toHaveTextContent('100% spotless');
  });

  it('tweens to 100% over 1.8s with an ease-out curve otherwise', () => {
    mockReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { frame } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sweep it for me' }));
    act(() => {
      vi.advanceTimersByTime(SWEEP_MS / 2);
    });
    const mid = parseFloat(frame.style.getPropertyValue('--p'));
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
    act(() => {
      vi.advanceTimersByTime(SWEEP_MS);
    });
    expect(frame.style.getPropertyValue('--p')).toBe('100%');
    expect(screen.getByRole('status')).toHaveTextContent('100% spotless');
  });

  it('uses an ease-out cubic curve', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});
