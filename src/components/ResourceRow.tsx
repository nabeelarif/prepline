import { useEffect, useRef, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Ellipsis,
  FolderInput,
  Gauge,
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
}

export function ResourceRow({ r, index, count, phases, selected }: Props) {
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
      className={`res-row${r.done ? ' done' : ''}${selected ? ' is-selected' : ''}`}
    >
      <td className="c-check">
        <input
          type="checkbox"
          checked={r.done}
          aria-label={`${r.done ? 'Reopen' : 'Mark complete'}: ${r.title}`}
          onChange={() => changeStatus(r, r.done ? 'in_progress' : 'completed')}
        />
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
        <StatusMenu r={r} />
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
