import {
  BREAK_MS,
  FOCUS_MS,
  MAX_SESSION_MINUTES,
  creditedMinutes,
  fmtClock,
  parseTimer,
  pomodoroPhase,
  type TimerState,
} from './timer';

const MIN = 60_000;
const t = (mode: TimerState['mode']): TimerState => ({
  userId: 'u',
  goalId: 'g',
  resourceId: 'r',
  startedAt: 1_000_000,
  mode,
});
const at = (mins: number) => 1_000_000 + mins * MIN;

describe('study timer', () => {
  it('credits whole elapsed minutes, nothing under one', () => {
    expect(creditedMinutes(t('free'), at(0.9))).toBe(0);
    expect(creditedMinutes(t('free'), at(25.9))).toBe(25);
  });

  it('caps a forgotten timer', () => {
    expect(creditedMinutes(t('free'), at(24 * 60))).toBe(MAX_SESSION_MINUTES);
  });

  it('credits only focus time in Pomodoro mode', () => {
    expect(creditedMinutes(t('pomodoro'), at(10))).toBe(10);
    expect(creditedMinutes(t('pomodoro'), at(27))).toBe(25); // in the break
    expect(creditedMinutes(t('pomodoro'), at(30))).toBe(25);
    expect(creditedMinutes(t('pomodoro'), at(40))).toBe(35); // second focus slice
  });

  it('reports the Pomodoro phase and time left', () => {
    expect(pomodoroPhase(0)).toEqual({ phase: 'focus', remainingMs: FOCUS_MS });
    expect(pomodoroPhase(FOCUS_MS)).toEqual({ phase: 'break', remainingMs: BREAK_MS });
    expect(pomodoroPhase(FOCUS_MS + BREAK_MS + MIN).phase).toBe('focus');
  });

  it('formats a clock', () => {
    expect(fmtClock(65_000)).toBe('01:05');
    expect(fmtClock(3_725_000)).toBe('1:02:05');
  });

  it('parses stored timers leniently', () => {
    expect(parseTimer(t('pomodoro'))).toEqual(t('pomodoro'));
    expect(parseTimer({ ...t('free'), mode: 'weird' })?.mode).toBe('free');
    expect(parseTimer({ ...t('free'), startedAt: 'x' })).toBeNull();
    expect(parseTimer(null)).toBeNull();
  });
});
