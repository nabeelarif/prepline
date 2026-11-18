import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import { fmtDate, todayISO } from '../domain/dates';
import { fmtMin, pl } from '../domain/format';
import { currentStreak, heatmapWeeks, longestStreak } from '../domain/studyLog';
import { useStore } from '../state/store';

const WEEKS = 20;

/** Streak count and a heatmap of the last 20 weeks of study, across all plans. */
export function StudyLogCard() {
  const log = useStore((s) => s.studyLog);
  const today = todayISO();
  const stats = useMemo(() => {
    const weeks = heatmapWeeks(log.days, today, WEEKS);
    return {
      weeks,
      studiedDays: weeks.flat().filter((c) => c && c.minutes > 0).length,
      streak: currentStreak(log.days, today),
      best: longestStreak(log.days),
    };
  }, [log.days, today]);
  if (!log.ready) return null;

  const { weeks, studiedDays, streak, best } = stats;
  const studiedToday = log.days[today] ?? 0;

  return (
    <section className="study-log" aria-label="Study log">
      <div className="study-streak">
        <Flame aria-hidden="true" className={streak > 0 ? 'lit' : ''} />
        <div>
          <strong>{pl(streak, 'day')}</strong>
          <span className="muted">
            {streak > 0 ? 'current streak' : 'no streak yet'}
            {best > streak && ` · best ${best}`}
          </span>
          <span className="muted">
            {studiedToday > 0 ? `${fmtMin(studiedToday)} studied today` : 'Nothing logged today'}
          </span>
        </div>
      </div>
      <div className="study-heat-wrap">
        <div
          className="study-heat"
          role="img"
          aria-label={`Study heatmap, last ${WEEKS} weeks: ${pl(studiedDays, 'day')} studied`}
        >
          {weeks.map((week, w) => (
            <div className="study-week" key={w}>
              {week.map((c, d) => (
                <span
                  key={d}
                  className={c ? `study-cell lvl-${c.level}` : 'study-cell none'}
                  title={
                    c
                      ? `${fmtDate(c.day)}: ${c.minutes > 0 ? fmtMin(c.minutes) : 'no study'}`
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
