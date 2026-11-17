import { useState, type FormEvent } from 'react';
import { Play } from 'lucide-react';
import { addDays, todayISO, validISO } from '../../domain/dates';
import type { Goal } from '../../domain/types';
import { useStore } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';

const LENGTHS = [30, 60, 100];

type Choice = 'none' | 'date' | number;

/** Begin a plan today, and optionally give it a deadline. */
export function StartPlanDialog({ goal }: { goal: Goal }) {
  const { startPlan, closeOverlay } = useStore.getState();
  const [choice, setChoice] = useState<Choice>('none');
  const [date, setDate] = useState(addDays(todayISO(), 30));
  const [error, setError] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const today = todayISO();
    if (choice === 'none') return startPlan(goal.id, null);
    if (choice === 'date') {
      if (!validISO(date) || date < today) {
        setError('Pick a deadline that is today or later.');
        return e.currentTarget.querySelector<HTMLElement>('#sDate')?.focus();
      }
      return startPlan(goal.id, date);
    }
    startPlan(goal.id, addDays(today, choice - 1));
  };

  const radio = (value: Choice, label: string) => (
    <label className="choice">
      <input
        type="radio"
        name="deadline"
        checked={choice === value}
        onChange={() => {
          setChoice(value);
          setError('');
        }}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <form noValidate onSubmit={submit}>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <Play aria-hidden="true" />
        Start {goal.name}
      </h2>
      <fieldset className="field">
        <legend>Deadline</legend>
        {radio('none', 'No deadline')}
        {LENGTHS.map((n) => radio(n, `${n} days from today`))}
        {radio('date', 'A target date')}
      </fieldset>
      {choice === 'date' && (
        <label className="field">
          <span>Target Date</span>
          <input id="sDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Start plan
        </button>
      </div>
    </form>
  );
}
