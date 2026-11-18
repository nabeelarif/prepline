import { useState, type FormEvent } from 'react';
import { Target } from 'lucide-react';
import { validISO } from '../../domain/dates';
import type { Goal } from '../../domain/types';
import { useMatch, useNavigate } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';
import { sharingArgs, type SharingValue } from '../../domain/share';
import { DIALOG_TITLE } from '../Overlay';
import { SharingFields } from './SharingFields';

/** Create a plan (goal is null) or edit one. */
export function GoalForm({ goal }: { goal: Goal | null }) {
  const { createGoal, updateGoal, deleteGoal, closeOverlay, setPlanSharing, showToast } =
    useStore.getState();
  const sharingStatus = useStore((s) => s.sharing.status);
  const navigate = useNavigate();
  const onDashboard = useMatch(paths.dashboard) !== null;
  const viewedPlan = useMatch(`${paths.plans}/:planId`)?.params.planId;
  const [name, setName] = useState(goal?.name ?? '');
  // Only a started plan has a deadline to edit; new plans choose one when they start.
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [hours, setHours] = useState(goal?.hoursPerDay == null ? '' : String(goal.hoursPerDay));
  const [description, setDescription] = useState(goal?.description ?? '');
  // Who can open a new plan. An existing plan is shared from its Share button.
  const [share, setShare] = useState<SharingValue>({
    visibility: 'private',
    tags: '',
  });
  const [error, setError] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const focus = (id: string) => form.querySelector<HTMLElement>(`#${id}`)?.focus();
    const trimmed = name.trim();
    const hrs = hours.trim() ? parseFloat(hours) : null;
    if (!trimmed) {
      setError('Give the plan a title.');
      return focus('gName');
    }
    if (date && !validISO(date)) {
      setError('Pick a valid deadline, or clear it.');
      return focus('gDate');
    }
    if (date && goal?.startDate && date < goal.startDate) {
      setError('The deadline cannot be before the day the plan started.');
      return focus('gDate');
    }
    if (hrs !== null && !(hrs > 0)) {
      setError('Daily study hours must be more than 0, for example 1.5. Or leave it empty.');
      return focus('gHours');
    }
    const input = {
      name: trimmed,
      description: description.trim(),
      ...(goal?.startDate ? { targetDate: date || null } : {}),
      hoursPerDay: hrs === null ? null : Math.min(16, Math.max(0.25, hrs)),
    };
    if (goal) updateGoal(goal.id, input);
    else {
      const before = useStore.getState().data.activeGoalId;
      createGoal(input);
      // The new plan is current. Anywhere but the dashboard, open it at its own address.
      const after = useStore.getState().data.activeGoalId;
      if (!onDashboard && after && after !== before) navigate(paths.plan(after));
      if (after && after !== before && share.visibility !== 'private') {
        // The plan is saved in the background; sharing waits for that.
        void setPlanSharing(after, ...sharingArgs(share)).then((problem) => {
          if (problem) showToast(`Plan created, but it could not be shared: ${problem}`);
        });
      }
    }
  };

  return (
    <form noValidate onSubmit={submit}>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <Target aria-hidden="true" />
        {goal ? 'Edit Plan' : 'Create New Plan'}
      </h2>
      <label className="field">
        <span>Plan Title</span>
        <input
          id="gName"
          type="text"
          maxLength={120}
          value={name}
          placeholder="e.g. Senior iOS Developer Interview Prep"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="row2">
        {goal?.startDate && (
          <label className="field">
            <span>
              Deadline <small>(optional)</small>
            </span>
            <span className="suffixed">
              <input
                id="gDate"
                type="date"
                min={goal?.startDate ?? undefined}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {date && (
                <button type="button" className="btn sm" onClick={() => setDate('')}>
                  Clear
                </button>
              )}
            </span>
          </label>
        )}
        <label className="field">
          <span>
            Daily Study Hours <small>(optional)</small>
          </span>
          <span className="suffixed">
            <input
              id="gHours"
              type="number"
              inputMode="decimal"
              min={0.25}
              max={16}
              step={0.25}
              value={hours}
              placeholder="1.5"
              onChange={(e) => setHours(e.target.value)}
            />
            <span aria-hidden="true">hours</span>
          </span>
        </label>
      </div>
      <label className="field">
        <span>
          Description <small>(optional)</small>
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          value={description}
          placeholder="Briefly describe your goal…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {!goal && sharingStatus !== 'error' && (
        <SharingFields
          value={share}
          onChange={(next) => {
            setShare(next);
            setError('');
          }}
        />
      )}
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        {goal && (
          <ConfirmButton
            className="btn danger"
            confirmText="Delete plan, phases and resources?"
            onConfirm={() => {
              deleteGoal(goal.id);
              // Its own page no longer exists. Leave it, unless the delete was refused.
              const gone = !useStore.getState().data.goals.some((g) => g.id === goal.id);
              if (gone && viewedPlan === goal.id) navigate(paths.plans);
            }}
          >
            Delete plan
          </ConfirmButton>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {goal ? 'Save' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
}
