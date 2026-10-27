import type { CSSProperties } from 'react';
import { RATE_LABELS, RATINGS } from '../domain/constants';
import { fmtMin, pl } from '../domain/format';
import { isDone, resDone, resTotal } from '../domain/resources';
import type { Resource } from '../domain/types';
import { hostOf, safeUrl } from '../domain/urls';
import { useStore } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { DeleteIcon, DownIcon, EditIcon, UpIcon } from './icons';
import { TypeChip } from './TypeChip';

interface Props {
  r: Resource;
  index: number;
  count: number;
}

export function ResourceItem({ r, index, count }: Props) {
  const collapsed = useStore((s) => !!s.ui.collapsed[r.id]);
  const a = useStore.getState();

  const total = resTotal(r);
  const done = isDone(r);
  const hasSec = r.sections.length > 0;
  const pct = total ? Math.round((resDone(r) / total) * 100) : 0;
  const href = safeUrl(r.url);
  const host = hostOf(href);
  const open = hasSec && !collapsed;

  return (
    <li className={`res${done ? ' done' : ''}`}>
      {hasSec ? (
        <span
          className="ring"
          style={{ '--p': pct } as CSSProperties}
          role="img"
          aria-label={`${pct}% done`}
        />
      ) : (
        <button
          className={`tick${done ? ' on' : ''}`}
          aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${r.title}`}
          onClick={() => a.toggleResource(r.id)}
        />
      )}

      <div className="res-main">
        <div className="res-title">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {r.title}
            </a>
          ) : (
            r.title
          )}
        </div>
        <div className="sub">
          <TypeChip type={r.type} />
          <span className="mono">{fmtMin(total)}</span>
          {hasSec && (
            <span>
              {r.sections.filter((s) => s.done).length} of {pl(r.sections.length, 'section')} ·{' '}
              {pct}%
            </span>
          )}
          {host && <span>{host}</span>}
          {done && (
            <>
              <span className="rate-inline" aria-label="Your rating">
                {RATINGS.map((v) => (
                  <button
                    key={v}
                    className={r.rating && v <= r.rating ? 'on' : undefined}
                    aria-label={`Rate ${v} of 5, ${RATE_LABELS[v]}`}
                    title={`${v} · ${RATE_LABELS[v]}`}
                    onClick={() => a.rate(r.id, v)}
                  />
                ))}
              </span>
              <span>{r.rating ? RATE_LABELS[r.rating] : 'Not rated'}</span>
            </>
          )}
        </div>
        {r.notes && <p className="res-notes">{r.notes}</p>}
      </div>

      <div className="res-actions">
        <button
          className="icon-btn"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => a.moveResource(r.id, -1)}
        >
          <UpIcon />
        </button>
        <button
          className="icon-btn"
          aria-label="Move down"
          disabled={index === count - 1}
          onClick={() => a.moveResource(r.id, 1)}
        >
          <DownIcon />
        </button>
        <button
          className="icon-btn"
          aria-label="Edit"
          onClick={() => a.openOverlay({ kind: 'resource', resourceId: r.id })}
        >
          <EditIcon />
        </button>
        <ConfirmButton
          className="icon-btn"
          aria-label="Delete"
          confirmText="Delete?"
          onConfirm={() => a.deleteResource(r.id)}
        >
          <DeleteIcon />
        </ConfirmButton>
      </div>

      {hasSec && (
        <div className="res-extra">
          <button className="linkish" aria-expanded={open} onClick={() => a.toggleCollapsed(r.id)}>
            {open ? 'Hide sections' : `Show ${pl(r.sections.length, 'section')}`}
          </button>
          {open && (
            <ul className="secs">
              {r.sections.map((s) => (
                <li key={s.id} className={s.done ? 'on' : undefined}>
                  <button
                    className={`tick sm${s.done ? ' on' : ''}`}
                    aria-label={`${s.done ? 'Mark not done' : 'Mark done'}: ${s.title}`}
                    onClick={() => a.toggleSection(r.id, s.id)}
                  />
                  <span className="st">{s.title}</span>
                  <span className="mono muted">{fmtMin(s.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
