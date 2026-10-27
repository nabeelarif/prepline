import { CirclePlay, CodeXml, FileText, GraduationCap, type LucideIcon } from 'lucide-react';
import type { ResourceType } from '../domain/types';

/** Brand mark: a path climbing through three stops to a peak. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M7 23 L13 15 L17 19 L25 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="9" r="2.6" fill="#fff" />
    </svg>
  );
}

const TYPE_ICONS: Record<ResourceType, LucideIcon> = {
  video: CirclePlay,
  article: FileText,
  course: GraduationCap,
  practice: CodeXml,
};

export function TypeIcon({ type, size = 18 }: { type: ResourceType; size?: number }) {
  const Icon = TYPE_ICONS[type];
  return <Icon className={`type-icon t-${type}`} size={size} aria-hidden="true" />;
}
