import { z } from 'zod';

/** Pomodoro lengths. Fixed: there is no settings UI. */
export const FOCUS_MS = 25 * 60_000;
export const BREAK_MS = 5 * 60_000;
const CYCLE_MS = FOCUS_MS + BREAK_MS;

/** One session never credits more than this, so a forgotten timer can't inflate the log. */
export const MAX_SESSION_MINUTES = 4 * 60;

export type TimerMode = 'free' | 'pomodoro';

/** A running timer. `startedAt` is epoch milliseconds, so elapsed time survives a reload. */
export interface TimerState {
  userId: string;
  goalId: string;
  resourceId: string;
  startedAt: number;
  mode: TimerMode;
}

export function elapsedMs(t: Pick<TimerState, 'startedAt'>, now: number): number {
  return Math.max(0, now - t.startedAt);
}

export interface PomodoroPhase {
  phase: 'focus' | 'break';
  remainingMs: number;
}

/** Where a Pomodoro timer is, given the time since it started. */
export function pomodoroPhase(elapsed: number): PomodoroPhase {
  const at = Math.max(0, elapsed) % CYCLE_MS;
  return at < FOCUS_MS
    ? { phase: 'focus', remainingMs: FOCUS_MS - at }
    : { phase: 'break', remainingMs: CYCLE_MS - at };
}

/** Milliseconds of focus within the elapsed time (all of it for a free timer). */
function focusMs(mode: TimerMode, elapsed: number): number {
  if (mode === 'free') return elapsed;
  const full = Math.floor(elapsed / CYCLE_MS);
  return full * FOCUS_MS + Math.min(elapsed % CYCLE_MS, FOCUS_MS);
}

/** Whole minutes to credit for a session stopped at `now`; under a minute credits nothing. */
export function creditedMinutes(t: TimerState, now: number): number {
  const minutes = Math.floor(focusMs(t.mode, elapsedMs(t, now)) / 60_000);
  return Math.min(minutes, MAX_SESSION_MINUTES);
}

/** What to show for a running timer: the clock (time left in Pomodoro, else elapsed) and phase. */
export function timerView(
  t: TimerState,
  now: number,
): { clock: string; phase: PomodoroPhase['phase'] | null } {
  const elapsed = elapsedMs(t, now);
  if (t.mode !== 'pomodoro') return { clock: fmtClock(elapsed), phase: null };
  const p = pomodoroPhase(elapsed);
  return { clock: fmtClock(p.remainingMs), phase: p.phase };
}

/** "mm:ss", or "h:mm:ss" from an hour up. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const sec = String(s % 60).padStart(2, '0');
  const min = Math.floor(s / 60);
  if (min < 60) return `${String(min).padStart(2, '0')}:${sec}`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}:${sec}`;
}

const timerSchema = z.object({
  userId: z.string().min(1),
  goalId: z.string().min(1),
  resourceId: z.string().min(1),
  startedAt: z.number().finite().positive(),
  mode: z.enum(['free', 'pomodoro']).catch('free'),
});

/** Reads a stored timer; anything unusable gives null. */
export function parseTimer(raw: unknown): TimerState | null {
  const r = timerSchema.safeParse(raw);
  return r.success ? r.data : null;
}
