import type { ServiceIcon as IconKey } from '@/content';

/** 48px-grid service icons from Services.dc.html: 2.6px ink stroke, Bubblegum fills. */
export function ServiceIcon({ icon, size = 84 }: { icon: IconKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="#0B0B0C"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon === 'home' ? (
        <>
          <path d="M8 22L24 8l16 14v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#FF7DB8" />
          <path d="M19 40V28h10v12" fill="#fff" />
        </>
      ) : icon === 'bucket' ? (
        <>
          <path d="M12 21h24l-3 20H15z" fill="#FF7DB8" />
          <path d="M9 21h30M16 21c0-7 16-7 16 0" />
          <circle cx="19" cy="10" r="3" fill="#fff" />
          <circle cx="30" cy="7" r="2" fill="#fff" />
        </>
      ) : icon === 'key' ? (
        <>
          <circle cx="15" cy="24" r="8" fill="#FF7DB8" />
          <circle cx="15" cy="24" r="2.5" fill="#fff" />
          <path d="M23 24h19M35 24v7M42 24v5" />
        </>
      ) : icon === 'repeat' ? (
        <>
          <circle cx="24" cy="24" r="9" fill="#FF7DB8" stroke="none" />
          <path d="M39 20a15.5 15.5 0 0 0-28-5M10 7v9h9M9 28a15.5 15.5 0 0 0 28 5M38 41v-9h-9" />
        </>
      ) : (
        <>
          <path d="M14 9h20l8 11-18 20L6 20z" fill="#FF7DB8" />
          <path d="M6 20h36M18 9l-4 11 10 20 10-20-4-11" />
        </>
      )}
    </svg>
  );
}
