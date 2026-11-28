import { Pause, Play, Timer } from 'lucide-react';
import { useState } from 'react';
import { BREAK_MS, FOCUS_MS, timerView } from '../domain/timer';
import type { Resource } from '../domain/types';
import { useNow } from '../hooks/useNow';
import { useTimer } from '../state/timer';

const POMODORO_HINT = `Study in ${FOCUS_MS / 60_000}-minute focus rounds with a ${BREAK_MS / 60_000}-minute break after each. Only focus time is logged.`;

/** Start and stop the study timer on one resource; stopping credits the minutes. */
export function TimerButton({ goalId, r }: { goalId: string; r: Resource }) {
  const timer = useTimer((s) => s.timer);
  const [pomodoro, setPomodoro] = useState(false);
  const mine = timer?.resourceId === r.id && timer.goalId === goalId;
  const now = useNow(mine);
  if (r.done) return null;

  if (mine) {
    const { clock, phase } = timerView(timer, now);
    return (
      <button
        className="btn sm"
        onClick={() => useTimer.getState().stop()}
        aria-label="Stop timer and log time"
      >
        <Pause size={15} aria-hidden="true" /> <span className="timer-clock">{clock}</span>
        {` ${phase ? (phase === 'focus' ? 'Focus' : 'Break') : 'Stop'}`}
      </button>
    );
  }

  return (
    <span className="timer-start">
      <button
        className="btn sm"
        onClick={() => useTimer.getState().start(goalId, r.id, pomodoro ? 'pomodoro' : 'free')}
      >
        <Play size={15} aria-hidden="true" /> Start timer
      </button>
      <label className="timer-pomodoro" title={POMODORO_HINT}>
        <input type="checkbox" checked={pomodoro} onChange={(e) => setPomodoro(e.target.checked)} />
        <Timer size={13} aria-hidden="true" /> Focus + breaks
      </label>
    </span>
  );
}
