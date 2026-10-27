import { ChevronDown } from 'lucide-react';
import { STATUS_TEXT } from '../domain/constants';
import { resDone, resStatus, statusLosesProgress } from '../domain/resources';
import type { Resource, ResourceStatus } from '../domain/types';
import { Menu } from './Menu';
import { changeStatus } from './statusActions';

const ORDER: ResourceStatus[] = ['not_started', 'in_progress', 'completed'];

/** Status pill that opens a menu to change it. Clearing progress asks for a second click. */
export function StatusMenu({ r }: { r: Resource }) {
  const status = resStatus(r);
  const pct = r.minutes ? Math.round((resDone(r) / r.minutes) * 100) : 0;
  return (
    <Menu
      label={`Status: ${STATUS_TEXT[status]}. Change status of ${r.title}`}
      triggerClass={`status status-btn s-${status}`}
      trigger={
        <>
          {STATUS_TEXT[status]}
          {status === 'in_progress' && pct > 0 && ` · ${pct}%`}
          <ChevronDown size={13} aria-hidden="true" />
        </>
      }
      items={ORDER.map((to) => ({
        label: STATUS_TEXT[to],
        checked: to === status,
        icon: <i className={`status-dot s-${to}`} />,
        confirm:
          to !== status && statusLosesProgress(r, to) ? 'Clear progress? Click again' : undefined,
        onSelect: () => to !== status && changeStatus(r, to),
      }))}
    />
  );
}
