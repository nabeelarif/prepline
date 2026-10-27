import { diffDays } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import type { Pace } from '../domain/pace';
import type { Goal, ISODate } from '../domain/types';

/** Short status for a pill, and one line explaining it. */
export function paceText(p: Pace, g: Goal): { label: string; detail: string } {
  const need = `${fmtHours(p.requiredPerDay)}/day`;
  const have = g.hoursPerDay == null ? '' : `${fmtHours(g.hoursPerDay * 60)}/day`;
  switch (p.kind) {
    case 'idle':
      return { label: 'Nothing planned yet', detail: 'Add resources to see your pace.' };
    case 'done':
      return { label: 'Complete', detail: 'Every resource is done.' };
    case 'past':
      return { label: 'Past target date', detail: 'Pick a new target date in Edit plan.' };
    case 'no_capacity':
      return {
        label: `Needs ${need}`,
        detail: 'Set daily study hours in Edit plan to see if you are on track.',
      };
    case 'on_track':
      return { label: 'On Track', detail: `Needs ${need} · you planned ${have}` };
    case 'at_risk':
      return { label: 'At Risk', detail: `Needs ${need} · close to your ${have}` };
    case 'behind':
      return { label: 'Behind Schedule', detail: `Needs ${need} · you planned ${have}` };
  }
}

/** "24 days", "Due today", "3 days past". */
export function daysLeftText(today: ISODate, target: ISODate): string {
  const dl = diffDays(today, target);
  return dl < 0 ? `${pl(-dl, 'day')} past` : dl === 0 ? 'Due today' : pl(dl, 'day');
}
