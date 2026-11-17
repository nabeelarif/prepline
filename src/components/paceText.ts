import { diffDays, fmtDate } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import type { Pace, Velocity } from '../domain/pace';
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
    case 'not_started':
      return { label: 'Not started', detail: 'Start the plan when you are ready.' };
    case 'open':
      return { label: 'No deadline', detail: 'Follow it at your own pace.' };
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

/** Number and label for the "days left" tile: "24 days" / "Left", "Today" / "Due", "3 days" / "Past due". */
export function daysLeftTile(today: ISODate, target: ISODate): [string, string] {
  const dl = diffDays(today, target);
  return dl > 0
    ? [pl(dl, 'day'), 'Left']
    : dl === 0
      ? ['Today', 'Due']
      : [pl(-dl, 'day'), 'Past due'];
}

/** "(6 weeks left)" from two weeks out, otherwise days; "passed" and "due today" after. */
export function untilText(today: ISODate, target: ISODate): string {
  const dl = diffDays(today, target);
  if (dl < 0) return 'passed';
  if (dl === 0) return 'due today';
  return `${dl >= 14 ? pl(Math.round(dl / 7), 'week') : pl(dl, 'day')} left`;
}

/** "24 days", "Due today", "3 days past". */
export function daysLeftText(today: ISODate, target: ISODate): string {
  const dl = diffDays(today, target);
  return dl < 0 ? `${pl(-dl, 'day')} past` : dl === 0 ? 'Due today' : pl(dl, 'day');
}

/** Headline, tag and one sentence for the velocity strip. */
export function velocityText(
  v: Velocity,
  g: Goal,
  remaining: number,
): { headline: string; tag: string; detail: string } {
  const req = `${fmtHours(v.requiredMin)}/day`;
  const plan = `${fmtHours(v.plannedMin)}/day`;
  const left = g.targetDate
    ? `${fmtHours(remaining)} by ${fmtDate(g.targetDate)}`
    : fmtHours(remaining);
  const gap = `${fmtHours(Math.abs(v.diffMin))} / day`;
  if (v.kind === 'behind') {
    return {
      headline: `Velocity Gap: ${gap} short`,
      tag: 'Over Capacity',
      detail: `You planned ${plan} but need ${req} to finish the remaining ${left}. Raise your daily hours or move the target date.`,
    };
  }
  return {
    headline: `Velocity Buffer: +${gap} ahead`,
    tag: v.kind === 'on_track' ? 'Safe Margin' : 'Tight Margin',
    detail:
      v.kind === 'on_track'
        ? `You planned ${plan}, but only require ${req} to comfortably complete the remaining ${left}.`
        : `You planned ${plan} and require ${req}, close to your limit, to finish the remaining ${left}.`,
  };
}
