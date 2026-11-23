import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { fmtMin, pl } from '../domain/format';
import { currentStreak, heatmapWeeks, longestStreak, monthLabels } from '../domain/studyLog';
import { useStore } from '../state/store';

/** A year of weekly columns: the 371 loaded days cover 53 of them. */
const WEEKS = 53;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** The study streak and a GitHub-style grid of every day studied in the past year. */
export function StreakPage() {
  const log = useStore((s) => s.studyLog);
  const today = todayISO();
  const stats = useMemo(() => {
    const weeks = heatmapWeeks(log.days, today, WEEKS);
    return {
      weeks,
      months: monthLabels(weeks),
      studiedDays: weeks.flat().filter((c) => c && c.minutes > 0).length,
      streak: currentStreak(log.days, today),
      best: longestStreak(log.days),
    };
  }, [log.days, today]);

  const { weeks, months, studiedDays, streak, best } = stats;
  const studiedToday = log.days[today] ?? 0;

  return (
    <>
      <header className="page-head">
        <h1>Study streak</h1>
      </header>
      {!log.ready ? (
        <p role="status">The study log isn’t available yet.</p>
      ) : (
        <section className="card streak-page" aria-label="Study log">
          <div className="streak-summary">
            <Flame aria-hidden="true" className={streak > 0 ? 'lit' : ''} />
            <div>
              <strong>{pl(streak, 'day')}</strong>
              <span className="muted">{streak > 0 ? 'current streak' : 'no streak yet'}</span>
            </div>
            <div>
              <strong>{pl(best, 'day')}</strong>
              <span className="muted">best streak</span>
            </div>
            <div>
              <strong>{pl(studiedDays, 'day')}</strong>
              <span className="muted">studied in the last year</span>
            </div>
            <div>
              <strong>{studiedToday > 0 ? fmtMin(studiedToday) : '0m'}</strong>
              <span className="muted">today</span>
            </div>
          </div>
          <div className="streak-scroll">
            <div
              className="streak-grid"
              role="img"
              aria-label={`Study heatmap, last year: ${pl(studiedDays, 'day')} studied`}
              style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(10px, 1fr))` }}
            >
              <span />
              {months.map((m, w) => (
                <span className="streak-month" key={w}>
                  {m}
                </span>
              ))}
              {DAY_LABELS.map((label, d) => (
                <div className="streak-row" key={d}>
                  <span className="streak-day">{label}</span>
                  {weeks.map((week, w) => {
                    const c = week[d];
                    return (
                      <span
                        key={w}
                        className={c ? `study-cell lvl-${c.level}` : 'study-cell none'}
                        title={
                          c
                            ? `${fmtDate(c.day)}: ${c.minutes > 0 ? fmtMin(c.minutes) : 'no study'}`
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="streak-legend" aria-hidden="true">
            <span className="muted">Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`study-cell lvl-${l}`} />
            ))}
            <span className="muted">More</span>
          </div>
        </section>
      )}
    </>
  );
}
