import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Ellipsis,
  FolderInput,
  Gauge,
  GripVertical,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { TYPES } from '../domain/constants';
import { fmtHours } from '../domain/format';
import { resStatus } from '../domain/resources';
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
  /** Pointer and key handlers for the drag handle, from `useReorderDrag`. */
  handle: HTMLAttributes<HTMLButtonElement>;
  drag: { dragging?: boolean; dy?: number; dropLine?: 'before' | 'after' };
}

export function ResourceRow({ r, index, count, phases, selected, handle, drag }: Props) {
  const a = useStore.getState();
  const row = useRef<HTMLTableRowElement>(null);
  const status = resStatus(r);
  const href = safeUrl(r.url);
  const phase = phases.find((p) => p.id === r.phaseId);

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

  return (
    <tr
      ref={row}
      id={`res-${r.id}`}
      data-reorder-id={r.id}
      className={`res-row${r.done ? ' done' : ''}${selected ? ' is-selected' : ''}${
        drag.dragging ? ' dragging' : ''
      }${drag.dropLine ? ` drop-${drag.dropLine}` : ''}`}
      style={drag.dragging ? { transform: `translateY(${drag.dy ?? 0}px)` } : undefined}
    >
      <td className="c-drag">
        <button
          type="button"
          className="icon-btn drag-handle"
          aria-label={`Reorder ${r.title}`}
          title="Drag to reorder, or use the arrow keys"
          {...handle}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
      </td>
      <td className="c-title">
        <div className="res-title">
          <TypeIcon type={r.type} />
          <div className="res-name">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
            ) : (
              <span>{r.title}</span>
            )}
            {href && <small>{hostOf(href)}</small>}
          </div>
        </div>
      </td>
      <td className="c-type">
        <span className={`tag t-${r.type}`}>{TYPES[r.type]}</span>
      </td>
      <td className="c-time">{fmtHours(r.minutes)}</td>
      <td className="c-status">
        <div className="status-cell">
          <StatusMenu r={r} />
          {status === 'in_progress' && (
            <button
              type="button"
              className="icon-btn progress-btn"
              aria-label={`Update progress of ${r.title}`}
              title="Update progress"
              onClick={() => a.openOverlay({ kind: 'details', resourceId: r.id })}
            >
              <Gauge size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </td>
      <td className="c-phase">
        {phase ? (
          <span className="ph-tag" style={{ '--ph': `var(--ph-${phase.color})` } as CSSProperties}>
            {phase.name}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="c-actions">
        <Menu
          label={`Actions for ${r.title}`}
          triggerClass="icon-btn"
          trigger={<Ellipsis size={18} />}
          align="end"
          items={items}
        />
      </td>
    </tr>
  );
}
