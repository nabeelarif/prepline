import type { ReactNode } from 'react';
import type { Resource } from '../domain/types';
import { embedUrl, safeUrl } from '../domain/urls';
import { useStore } from '../state/store';

/**
 * The one place that decides how a resource opens: links with a known embed open in
 * the in-app viewer, everything else in a new tab. Renders nothing without a link.
 */
export function ResourceLink({
  r,
  className,
  onOpen,
  children,
}: {
  r: Resource;
  className?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const href = safeUrl(r.url);
  if (!href) return null;
  if (embedUrl(href))
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          onOpen?.();
          useStore.getState().openOverlay({ kind: 'viewer', resourceId: r.id });
        }}
      >
        {children}
      </button>
    );
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
      {children}
    </a>
  );
}
