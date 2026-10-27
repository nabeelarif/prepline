import { RATINGS } from '../domain/constants';
import { fmtHours, fmtMin, pl } from '../domain/format';
import type { Metrics } from '../domain/metrics';

export function Stats({ met }: { met: Metrics }) {
  const r = met.readiness;
  const on = r ? Math.round(r) : 0;

  return (
    <section className="stats" aria-label="Summary">
      <div className="stat">
        <p className="stat-label">Progress by hours</p>
        <p className="stat-num">
          {met.pct}
          <span>%</span>
        </p>
        <div className="bar">
          <i style={{ width: `${met.pct}%` }} />
        </div>
        <p className="stat-sub">
          {met.doneCount} of {pl(met.count, 'resource')} finished
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">Time</p>
        <p className="stat-num">
          {fmtHours(met.done)}
          <span> of {fmtHours(met.total)}</span>
        </p>
        <p className="stat-sub">
          {fmtMin(met.remaining)} left
          {met.doneToday ? ` · ${fmtMin(met.doneToday)} done today` : ''}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">Readiness</p>
        <p className="stat-num">
          {r ? r.toFixed(1) : '–'}
          <span> / 5</span>
        </p>
        <div className="pips" aria-hidden="true">
          {RATINGS.map((i) => (
            <i key={i} className={i <= on ? 'on' : undefined} />
          ))}
        </div>
        <p className="stat-sub">
          {met.rated
            ? `Your average self-rating across ${pl(met.rated, 'finished item')}`
            : 'Rate items as you finish them'}
        </p>
      </div>
    </section>
  );
}
