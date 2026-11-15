import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  FolderInput,
  Gauge,
  ExternalLink,
  GripVertical,
  Pencil,
  Play,
  RotateCcw,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { TYPES } from '../domain/constants';
import { fmtHours } from '../domain/format';
import { fmtDate } from '../domain/dates';
import { metrics } from '../domain/metrics';
import { resDone, resStatus } from '../domain/resources';
import type { Phase, Resource } from '../domain/types';
import { hostOf, safeUrl } from '../domain/urls';
import { useStore } from '../state/store';
import { TypeIcon } from './icons';
import { Menu, type MenuEntry } from './Menu';
import { StatusMenu } from './StatusMenu';
import { changeStatus } from './statusActions';

interface Props {
  r: Resource;
  index: number;
  count: number;
  phases: Phase[];
  selected: boolean;
  /** The resource to do next: highlighted with a "Next up" tag. */
  focus: boolean;
  /** Pointer and key handlers for the drag handle, from `useReorderDrag`. */
  handle: HTMLAttributes<HTMLButtonElement>;
  drag: { dragging?: boolean; dy?: number; dropLine?: 'before' | 'after' };
}

/**
 * Whether a clamped element hides text: it overflows, or the text has line breaks
 * that the clamped preview folds away. Re-measures when the element is resized
 * or web fonts finish loading, which can lengthen the text without resizing the box.
 * Pass `shown` false while the element is not rendered: observing starts again when
 * it returns, and a removed element (which measures as empty) is never measured.
 */
function useClamped(ref: RefObject<HTMLElement | null>, text: string, shown: boolean): boolean {
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    const measure = () =>
      setClamped(/\n/.test(text.trim()) || el.scrollHeight > el.clientHeight + 1);
    measure();
    // Missing in jsdom.
    const fonts = document.fonts as FontFaceSet | undefined;
    fonts?.addEventListener('loadingdone', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      fonts?.removeEventListener('loadingdone', measure);
      ro?.disconnect();
    };
  }, [ref, text, shown]);
  return clamped;
}

export function ResourceCard({ r, index, count, phases, selected, focus, handle, drag }: Props) {
  const a = useStore.getState();
  const row = useRef<HTMLLIElement>(null);
  const status = resStatus(r);
  const href = safeUrl(r.url);
  const phase = phases.find((p) => p.id === r.phaseId);
  const notes = r.notes.trim();
  const [open, setOpen] = useState(false);
  const preview = useRef<HTMLParagraphElement>(null);
  // Measured only while collapsed: open notes never overflow.
  const clamped = useClamped(preview, notes, !!notes && !open);

  useEffect(() => {
    if (!selected) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.current?.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [selected]);

  const items: MenuEntry[] = [];
  if (status === 'not_started')
    items.push({
      label: 'Start',
      icon: <Play size={16} />,
      onSelect: () => changeStatus(r, 'in_progress'),
    });
  items.push(
    {
      label: 'Update progress',
      icon: <Gauge size={16} />,
      onSelect: () => a.openOverlay({ kind: 'details', resourceId: r.id }),
    },
    r.done
      ? {
          label: 'Reopen',
          icon: <RotateCcw size={16} />,
          onSelect: () => changeStatus(r, 'in_progress'),
        }
      : {
          label: 'Mark completed',
          icon: <Check size={16} />,
          onSelect: () => changeStatus(r, 'completed'),
        },
    {
      label: 'Edit resource',
      icon: <Pencil size={16} />,
      onSelect: () => a.openOverlay({ kind: 'resource', resourceId: r.id }),
    },
    'divider',
    {
      label: 'Move up',
      icon: <ArrowUp size={16} />,
      disabled: index === 0,
      onSelect: () => a.moveResource(r.id, -1),
    },
    {
      label: 'Move down',
      icon: <ArrowDown size={16} />,
      disabled: index === count - 1,
      onSelect: () => a.moveResource(r.id, 1),
    },
  );
  if (phases.length)
    items.push(
      'divider',
      { heading: 'Move to phase' },
      ...[{ id: null, name: 'No phase' }, ...phases].map((p) => ({
        label: p.name,
        checked: r.phaseId === p.id,
        icon: <FolderInput size={16} />,
        onSelect: () => a.setResourcePhase(r.id, p.id),
      })),
    );
  items.push('divider', {
    label: 'Delete resource',
    icon: <Trash2 size={16} />,
    danger: true,
    confirm: 'Click again to delete',
    onSelect: () => a.deleteResource(r.id),
  });

  const pct = status === 'in_progress' ? metrics([r]).pct : 0;
  const statusIcon =
    status === 'completed' ? (
      <Check size={18} aria-hidden="true" />
    ) : status === 'in_progress' ? (
      <Play size={16} aria-hidden="true" />
    ) : (
      <TypeIcon type={r.type} />
    );

  return (
    <li
      ref={row}
      id={`res-${r.id}`}
      data-reorder-id={r.id}
      className={`res-card s-${status}${selected ? ' is-selected' : ''}${focus ? ' is-focus' : ''}${
        drag.dragging ? ' dragging' : ''
      }${drag.dropLine ? ` drop-${drag.dropLine}` : ''}`}
      style={drag.dragging ? { transform: `translateY(${drag.dy ?? 0}px)` } : undefined}
    >
      <button
        type="button"
        className="icon-btn drag-handle"
        aria-label={`Reorder ${r.title}`}
        title="Drag to reorder, or use the arrow keys"
        {...handle}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <span className={`res-badge t-${r.type}`}>{statusIcon}</span>
      <div className="res-body">
        <p className="res-meta">
          <span className={`res-type t-${r.type}`}>{TYPES[r.type]}</span>
          <i aria-hidden="true">•</i>
          <span>{fmtHours(r.minutes)}</span>
          {href && (
            <>
              <i aria-hidden="true">•</i>
              <span>{hostOf(href)}</span>
            </>
          )}
        </p>
        <p className="res-title">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {r.title}
              <ExternalLink className="ext" size={14} aria-hidden="true" />
            </a>
          ) : (
            <span>{r.title}</span>
          )}
        </p>
        {status === 'completed' && (
          <p className="res-sub">
            Completed {fmtHours(resDone(r))} of {fmtHours(r.minutes)}
            {r.doneAt && ` • Finished ${fmtDate(r.doneAt, true)}`}
          </p>
        )}
        {notes && (
          <div className={`res-notes-line${open ? ' open' : ''}`}>
            <StickyNote size={15} aria-hidden="true" className="res-notes-icon" />
            <p id={`notes-${r.id}`} className={`res-notes${open ? ' open' : ''}`} ref={preview}>
              {notes}
            </p>
            {(open || clamped) && (
              <button
                type="button"
                className="link-btn"
                aria-expanded={open}
                aria-controls={`notes-${r.id}`}
                onClick={() => setOpen(!open)}
              >
                {open ? 'Show less' : 'Show more'}
                {open ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        )}
        {status === 'in_progress' && (
          <div className="res-progress">
            <div
              className="res-bar"
              role="progressbar"
              aria-label={`Progress of ${r.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <i style={{ width: `${pct}%` }} />
            </div>
            <span>
              {fmtHours(resDone(r))} / {fmtHours(r.minutes)}
            </span>
          </div>
        )}
      </div>
      <div className="res-side">
        {focus && <span className="next-tag">Next up</span>}
        <StatusMenu r={r} />
        {status === 'not_started' && (
          <button type="button" className="btn sm" onClick={() => changeStatus(r, 'in_progress')}>
            <Play size={14} aria-hidden="true" /> Start
          </button>
        )}
        {status === 'in_progress' && (
          <button
            type="button"
            className="btn sm primary"
            onClick={() => a.openOverlay({ kind: 'details', resourceId: r.id })}
          >
            <Gauge size={14} aria-hidden="true" /> Update progress
          </button>
        )}
        {status === 'completed' && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Reopen ${r.title}`}
            title="Reopen"
            onClick={() => changeStatus(r, 'in_progress')}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        )}
        {!phase && phases.length > 0 && (
          <Menu
            label={`Assign ${r.title} to a phase`}
            triggerClass="btn sm"
            trigger={
              <>
                <FolderInput size={14} aria-hidden="true" /> Assign phase
              </>
            }
            align="end"
            items={phases.map((p) => ({
              label: p.name,
              icon: (
                <i className="ph-dot" style={{ '--ph': `var(--ph-${p.color})` } as CSSProperties} />
              ),
              onSelect: () => a.setResourcePhase(r.id, p.id),
            }))}
          />
        )}
        <Menu
          label={`Actions for ${r.title}`}
          triggerClass="icon-btn"
          trigger={<Ellipsis size={18} />}
          align="end"
          items={items}
        />
      </div>
    </li>
  );
}
