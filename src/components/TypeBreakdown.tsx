import { TYPES } from '../domain/constants';
import { fmtHours } from '../domain/format';
import { metricsByType } from '../domain/metrics';
import type { Resource } from '../domain/types';

/** Where the plan's hours go: one bar split by type, with done / total hours per type. */
export function TypeBreakdown({ resources }: { resources: Resource[] }) {
  const shares = metricsByType(resources);
  // One type adds nothing the plan box does not already say.
  if (shares.length < 2) return null;
  return (
    <div className="type-breakdown">
      <h3>Time by type</h3>
      <div className="tb-bar" role="img" aria-label="Estimated time by type">
        {shares.map((s) => (
          <span
            key={s.type}
            className={`tb-seg t-${s.type}`}
            style={{ flexGrow: s.total }}
            title={`${TYPES[s.type]}: ${fmtHours(s.total)}`}
          />
        ))}
      </div>
      <ul className="tb-legend">
        {shares.map((s) => (
          <li key={s.type} className={`t-${s.type}`}>
            <span className="tb-dot" aria-hidden="true" />
            {TYPES[s.type]}
            <span className="muted">
              {fmtHours(s.done)} / {fmtHours(s.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
