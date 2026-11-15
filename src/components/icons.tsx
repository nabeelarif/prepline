import { CirclePlay, CodeXml, FileText, GraduationCap, type LucideIcon } from 'lucide-react';
import type { ResourceType } from '../domain/types';
import logoUrl from '../assets/logo.png';

/** Brand mark: the Road to Goals "R" road icon. */
export function Logo() {
  return <img className="logo" src={logoUrl} alt="" />;
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
