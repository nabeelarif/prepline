import { useState, type FormEvent } from 'react';
import { addDays, todayISO, validISO } from '../../domain/dates';
import type { Goal } from '../../domain/types';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';

/** Create a goal (goal is null) or edit an existing one. */
export function GoalForm({ goal }: { goal: Goal | null }) {
  const { createGoal, updateGoal, deleteGoal, closeOverlay } = useStore.getState();
  const [name, setName] = useState(goal?.name ?? '');
  const [date, setDate] = useState(goal?.targetDate ?? addDays(todayISO(), 30));
  const [hours, setHours] = useState(String(goal?.hoursPerDay ?? 2));
  const [error, setError] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const focus = (id: string) => form.querySelector<HTMLElement>(`#${id}`)?.focus();
    const trimmed = name.trim();
    const hrs = parseFloat(hours);
    if (!trimmed) {
      setError('Give the goal a name.');
      return focus('gName');
    }
    if (!validISO(date)) {
      setError('Pick a target date.');
      return focus('gDate');
    }
    if (!(hrs > 0)) {
      setError('Enter the hours you can spend each day, for example 1.5.');
      return focus('gHours');
    }
    const input = {
      name: trimmed,
      targetDate: date,
      hoursPerDay: Math.min(16, Math.max(0.25, hrs)),
    };
    if (goal) updateGoal(goal.id, input);
    else createGoal(input);
  };

  return (
    <form noValidate onSubmit={submit}>
      <h2>{goal ? 'Edit goal' : 'New goal'}</h2>
      <label className="field">
        <span>What are you preparing for?</span>
        <input
          id="gName"
          type="text"
          maxLength={120}
          value={name}
          placeholder="Senior iOS interview prep"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="row2">
        <label className="field">
          <span>Target date</span>
          <input id="gDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Hours per day</span>
          <input
            id="gHours"
            type="number"
            min={0.25}
            max={16}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <small>The timeline fills each day up to this.</small>
        </label>
      </div>
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        {goal && (
          <ConfirmButton
            className="btn danger"
            confirmText="Delete goal and its resources?"
            onConfirm={() => deleteGoal(goal.id)}
          >
            Delete goal
          </ConfirmButton>
        )}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {goal ? 'Save' : 'Create goal'}
        </button>
      </div>
    </form>
  );
}
