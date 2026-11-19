import { create } from 'zustand';
import { findResource } from '../domain/resources';
import { creditedMinutes, parseTimer, type TimerMode, type TimerState } from '../domain/timer';
import { useStore } from './store';

/*
 * The running study timer. Kept apart from AppData and `commit()`: it is a per-browser
 * setting like the theme, saved under one localStorage key so a reload resumes it. Only
 * the start time is stored; elapsed time is always worked out from the wall clock.
 * Stopping credits the minutes through `addStudyMinutes`, which feeds the study log.
 */
const KEY = 'roadtogoals:timer';

function readStored(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseTimer(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStored(t: TimerState | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the timer still runs for this visit.
  }
}

const currentUserId = () => useStore.getState().auth.user?.id ?? null;

/** The stored timer, if it belongs to the signed-in user. */
function load(): TimerState | null {
  const t = readStored();
  return t && t.userId === currentUserId() ? t : null;
}

export interface TimerStore {
  timer: TimerState | null;
  /** Starts a timer on a resource; one already running is stopped and credited first. */
  start(goalId: string, resourceId: string, mode: TimerMode): boolean;
  /**
   * Stops and credits the running timer. Returns false, with a toast saying why, when it
   * must keep running so no minutes are lost.
   */
  stop(): boolean;
  /** Ends the timer without crediting anything: the way out when crediting can't work. */
  discard(): void;
  /** Reloads from storage: after sign-in, sign-out, or a change in another tab. */
  sync(): void;
}

export const useTimer = create<TimerStore>((set, get) => ({
  timer: null,

  start: (goalId, resourceId, mode) => {
    const userId = currentUserId();
    if (!userId) return false;
    if (get().timer && !get().stop()) return false;
    const timer: TimerState = { userId, goalId, resourceId, startedAt: Date.now(), mode };
    writeStored(timer);
    set({ timer });
    return true;
  },

  stop: () => {
    const t = get().timer;
    if (!t) return true;
    // Another tab already stopped (and credited) or replaced this timer: credit nothing twice.
    const stored = readStored();
    if (stored?.startedAt !== t.startedAt || stored.resourceId !== t.resourceId) {
      get().sync();
      return true;
    }
    const app = useStore.getState();
    // An empty list while loading is not a missing resource.
    if (app.load.status !== 'ready') {
      app.showToast('Your plans are still loading. Try again in a moment.');
      return false;
    }
    const r = findResource(app.data.goals, t.goalId, t.resourceId);
    const minutes = creditedMinutes(t, Date.now());
    const creditable = r && !r.done && minutes >= 1;
    if (creditable && !app.addStudyMinutes(t.goalId, t.resourceId, minutes)) {
      app.showToast(
        app.busy
          ? 'Please wait until your data has finished saving.'
          : 'Your study log is not available, so this time cannot be saved. Use Discard to end the timer.',
      );
      return false;
    }
    if (!creditable)
      app.showToast(
        !r
          ? 'Resource is gone'
          : r.done
            ? 'Already completed: nothing logged'
            : 'Under a minute: nothing logged',
      );
    writeStored(null);
    set({ timer: null });
    return true;
  },

  discard: () => {
    writeStored(null);
    set({ timer: null });
  },

  sync: () => set({ timer: load() }),
}));

// Another tab started or stopped the timer, or the user changed.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) useTimer.getState().sync();
  });
  let lastUser = currentUserId();
  useStore.subscribe((s) => {
    const id = s.auth.user?.id ?? null;
    if (id === lastUser) return;
    lastUser = id;
    // Signed out: forget it. A different user's stored timer is ignored by load().
    if (!id) writeStored(null);
    useTimer.getState().sync();
  });
  useTimer.getState().sync();
}
