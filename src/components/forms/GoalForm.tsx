import { useState, type FormEvent } from 'react';
import { Target } from 'lucide-react';
import { addDays, todayISO, validISO } from '../../domain/dates';
import type { Goal } from '../../domain/types';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';
import { DIALOG_TITLE } from '../Overlay';

/** Create a plan (goal is null) or edit one. */
export function GoalForm({ goal }: { goal: Goal | null }) {
  const { createGoal, updateGoal, deleteGoal, closeOverlay } = useStore.getState();
  const [name, setName] = useState(goal?.name ?? '');
  const [date, setDate] = useState(goal?.targetDate ?? addDays(todayISO(), 42));
  const [hours, setHours] = useState(goal?.hoursPerDay == null ? '' : String(goal.hoursPerDay));
  const [description, setDescription] = useState(goal?.description ?? '');
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
    if (!validISO(date)) {
      setError('Pick a target date.');
      return focus('gDate');
    }
    if (hrs !== null && !(hrs > 0)) {
      setError('Daily study hours must be more than 0, for example 1.5. Or leave it empty.');
      return focus('gHours');
    }
    const input = {
      name: trimmed,
      description: description.trim(),
      targetDate: date,
      hoursPerDay: hrs === null ? null : Math.min(16, Math.max(0.25, hrs)),
    };
    if (goal) updateGoal(goal.id, input);
    else createGoal(input);
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
        <label className="field">
          <span>Target Date</span>
          <input id="gDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
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
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        {goal && (
          <ConfirmButton
            className="btn danger"
            confirmText="Delete plan, phases and resources?"
            onConfirm={() => deleteGoal(goal.id)}
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
