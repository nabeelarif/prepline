import { useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Flag } from 'lucide-react';
import { PHASE_COLORS } from '../../domain/constants';
import type { Goal, Phase, PhaseColor } from '../../domain/types';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';
import { DIALOG_TITLE } from '../Overlay';

/** Add a phase to the active plan (phase is null) or edit, reorder, or delete one. */
export function PhaseForm({ goal, phase }: { goal: Goal; phase: Phase | null }) {
  const { addPhase, updatePhase, deletePhase, movePhase, closeOverlay } = useStore.getState();
  const [name, setName] = useState(phase?.name ?? '');
  const [description, setDescription] = useState(phase?.description ?? '');
  const [color, setColor] = useState<PhaseColor>(phase?.color ?? 'blue');
  const [error, setError] = useState('');
  const index = phase ? goal.phases.findIndex((p) => p.id === phase.id) : -1;
  const count = phase ? goal.resources.filter((r) => r.phaseId === phase.id).length : 0;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the phase a title.');
      e.currentTarget.querySelector<HTMLElement>('#pName')?.focus();
      return;
    }
    const input = { name: trimmed, description: description.trim(), color };
    if (phase) updatePhase(phase.id, input);
    else addPhase(input);
  };

  return (
    <form noValidate onSubmit={submit}>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <Flag aria-hidden="true" />
        {phase ? 'Edit Phase' : 'Add Phase'} {!phase && <small>(Optional)</small>}
      </h2>
      <label className="field">
        <span>Phase Title</span>
        <input
          id="pName"
          type="text"
          maxLength={80}
          value={name}
          placeholder="e.g. SwiftUI & UI Design"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>
          Description <small>(optional)</small>
        </span>
        <textarea
          rows={2}
          maxLength={500}
          value={description}
          placeholder="What topics will this phase cover?"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <fieldset className="field">
        <legend>
          Color <small>(optional)</small>
        </legend>
        <div className="swatches">
          {PHASE_COLORS.map((c) => (
            <label key={c} className="swatch" style={{ '--ph': `var(--ph-${c})` } as CSSProperties}>
              <input
                type="radio"
                name="pColor"
                value={c}
                checked={color === c}
                aria-label={c}
                onChange={() => setColor(c)}
              />
              {color === c && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>
      {phase && goal.phases.length > 1 && (
        <div className="field">
          <span>Position</span>
          <div className="btn-row">
            <button
              type="button"
              className="btn sm"
              disabled={index === 0}
              onClick={() => movePhase(phase.id, -1)}
            >
              <ArrowUp size={15} aria-hidden="true" /> Move earlier
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={index === goal.phases.length - 1}
              onClick={() => movePhase(phase.id, 1)}
            >
              <ArrowDown size={15} aria-hidden="true" /> Move later
            </button>
          </div>
        </div>
      )}
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        {phase && (
          <ConfirmButton
            className="btn danger"
            confirmText={count ? 'Delete? Its resources are kept' : 'Delete phase?'}
            onConfirm={() => deletePhase(phase.id)}
          >
            Delete phase
          </ConfirmButton>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {phase ? 'Save' : 'Add Phase'}
        </button>
      </div>
    </form>
  );
}
