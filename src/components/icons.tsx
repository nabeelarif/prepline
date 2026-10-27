import type { ReactNode } from 'react';

export function Logo() {
  return (
    <svg viewBox="0 0 40 14" aria-hidden="true">
      <path d="M4 7h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="4.5" cy="7" r="3.8" fill="currentColor" />
      <circle className="hole" cx="20" cy="7" r="3.4" stroke="currentColor" strokeWidth="2" />
      <circle className="hole" cx="35.5" cy="7" r="3.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const UpIcon = () => (
  <Icon>
    <path d="M8 13V3.5M3.8 7.7 8 3.5l4.2 4.2" />
  </Icon>
);
export const DownIcon = () => (
  <Icon>
    <path d="M8 3v9.5M3.8 8.3 8 12.5l4.2-4.2" />
  </Icon>
);
export const EditIcon = () => (
  <Icon>
    <path d="M10.6 2.6l2.8 2.8L6 12.8H3.2V10z" />
  </Icon>
);
export const DeleteIcon = () => (
  <Icon>
    <path d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.3 4.3l.6 8.9h6.2l.6-8.9" />
  </Icon>
);
