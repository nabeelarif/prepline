import { useEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import { findResource } from '../domain/resources';
import { timerView } from '../domain/timer';
import { useNow } from '../hooks/useNow';
import { setTitlePrefix } from '../pageTitle';
import { useStore } from '../state/store';
import { useTimer } from '../state/timer';
import { ConfirmButton } from './ConfirmButton';

/** Shown on every page while a timer runs: what it is on, the clock, and Stop. */
export function TimerBar() {
  const timer = useTimer((s) => s.timer);
  const title = useStore((s) =>
    timer ? findResource(s.data.goals, timer.goalId, timer.resourceId)?.title : undefined,
  );
  const now = useNow(!!timer);
  const { clock, phase } = timer ? timerView(timer, now) : { clock: '', phase: null };

  useEffect(() => {
    if (!timer) return;
    setTitlePrefix(clock);
    return () => setTitlePrefix('');
  }, [timer, clock]);

  // Tell the user when a Pomodoro switches between focus and break (not on first render).
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (phase && lastPhase.current && phase !== lastPhase.current)
      useStore.getState().showToast(phase === 'break' ? 'Break time' : 'Back to focus');
    lastPhase.current = phase;
  }, [phase]);

  if (!timer) return null;
  return (
    <div className="timer-bar" role="timer" aria-label="Study timer">
      <span className="timer-clock">{clock}</span>
      <span className="timer-what">
        {phase && `${phase === 'focus' ? 'Focus' : 'Break'} · `}
        {title ?? 'Study session'}
      </span>
      <button className="btn sm" onClick={() => useTimer.getState().stop()}>
        <Square size={14} aria-hidden="true" /> Stop
      </button>
      <ConfirmButton
        className="btn sm ghost"
        confirmText="Discard time?"
        onConfirm={() => useTimer.getState().discard()}
      >
        Discard
      </ConfirmButton>
    </div>
  );
}
