import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, strokeWidth: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
});

export function ArrowRight({ size = 18, strokeWidth = 3, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PhoneIcon({ size = 18, strokeWidth = 2.4, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function ReplayIcon({ size = 15, strokeWidth = 2.4, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M4 12a8 8 0 1 1 2.6 5.9M4 20v-5h5" />
    </svg>
  );
}

export function CheckIcon({ size = 26, strokeWidth = 2.6, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function DoubleChevron({ size = 34, strokeWidth = 2.6, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
    </svg>
  );
}

export function HomeIcon({ size = 22, strokeWidth = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function SparkleIcon({ size = 22, strokeWidth = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7zM19 16v5M16.5 18.5h5" />
    </svg>
  );
}

export function RevealIcon({ size = 22, strokeWidth = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M12 3v18M8 10l-2 2 2 2M16 10l2 2-2 2" />
    </svg>
  );
}

export function PersonIcon({ size = 22, strokeWidth = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, Number(strokeWidth))} {...rest}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5" />
    </svg>
  );
}
