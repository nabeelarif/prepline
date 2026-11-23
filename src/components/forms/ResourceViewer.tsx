import { ExternalLink, Gauge } from 'lucide-react';
import { TYPES } from '../../domain/constants';
import type { Resource } from '../../domain/types';
import { embedUrl, hostOf, safeUrl } from '../../domain/urls';
import { useStore } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';
import { StatusButtons } from '../StatusButtons';
import { StatusMenu } from '../StatusMenu';

/**
 * Shows a resource inside the app. Only links with a known official embed (see
 * embedUrl) open here; every other link opens in a new tab straight from the list.
 */
export function ResourceViewer({ r }: { r: Resource }) {
  const { openOverlay } = useStore.getState();
  const href = safeUrl(r.url);
  const src = href && embedUrl(href);
  if (!src) return null;

  return (
    <div className="viewer">
      <h2 id={DIALOG_TITLE} className="sheet-title">
        {r.title}
      </h2>
      <div className="viewer-bar">
        <span className={`tag t-${r.type}`}>{TYPES[r.type]}</span>
        <StatusMenu r={r} />
        <span className="muted">{hostOf(href)}</span>
        <span className="spacer" />
        <a className="btn sm" href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden="true" /> Open in new tab
        </a>
      </div>

      <iframe
        className="viewer-frame"
        title={r.title}
        src={src}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />

      <div className="sheet-actions">
        <button
          type="button"
          className="btn"
          onClick={() => openOverlay({ kind: 'details', resourceId: r.id })}
        >
          <Gauge size={15} aria-hidden="true" /> Update progress
        </button>
        <span className="spacer" />
        <StatusButtons r={r} />
      </div>
    </div>
  );
}
