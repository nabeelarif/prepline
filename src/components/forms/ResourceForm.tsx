import { useRef, useState, type FormEvent } from 'react';
import { DEFAULT_MINUTES, RESOURCE_TYPES, TYPES } from '../../domain/constants';
import type { Phase, Resource, ResourceType } from '../../domain/types';
import { detectType, normUrl, safeUrl, titleFromUrl } from '../../domain/urls';
import { useStore } from '../../state/store';
import { TypeIcon } from '../icons';
import { DIALOG_TITLE } from '../Overlay';

const hoursOf = (min: number) => String(Math.round((min / 60) * 100) / 100);

interface Props {
  resource: Resource | null;
  phases: Phase[];
  /** Phase to preselect when adding from a phase. */
  presetPhase?: string | null;
}

/** Add a resource to the active plan (resource is null) or edit one. */
export function ResourceForm({ resource, phases, presetPhase }: Props) {
  const { addResource, updateResource, closeOverlay } = useStore.getState();
  const isNew = !resource;

  const [url, setUrl] = useState(resource?.url ?? '');
  const [title, setTitle] = useState(resource?.title ?? '');
  const [type, setType] = useState<ResourceType>(resource?.type ?? 'article');
  const [hours, setHours] = useState(hoursOf(resource?.minutes ?? DEFAULT_MINUTES.article));
  const [phaseId, setPhaseId] = useState(resource?.phaseId ?? presetPhase ?? '');
  const [notes, setNotes] = useState(resource?.notes ?? '');
  const [error, setError] = useState('');
  // Fields the user has set by hand stop being auto-filled from the URL.
  const touched = useRef({ type: !isNew, time: !isNew });
  const autoTitle = useRef('');

  const applyType = (t: ResourceType) => {
    setType(t);
    if (!touched.current.time) setHours(hoursOf(DEFAULT_MINUTES[t]));
  };

  const onUrl = (v: string) => {
    setUrl(v);
    const u = normUrl(v);
    if (!safeUrl(u)) return;
    if (!touched.current.type) applyType(detectType(u));
    if (!title.trim() || title === autoTitle.current) {
      autoTitle.current = titleFromUrl(u);
      setTitle(autoTitle.current);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const focus = (id: string) => form.querySelector<HTMLElement>(`#${id}`)?.focus();
    const u = normUrl(url);
    const finalTitle = title.trim() || (safeUrl(u) ? titleFromUrl(u) : '');
    const h = parseFloat(hours);
    if (!finalTitle) {
      setError('Add a title so you can recognize this later.');
      return focus('rTitle');
    }
    if (!(h > 0)) {
      setError('Estimated time must be more than 0 hours, for example 0.5.');
      return focus('rHours');
    }
    const input = {
      url: u,
      title: finalTitle.slice(0, 160),
      type,
      minutes: Math.max(1, Math.round(h * 60)),
      notes: notes.trim(),
      phaseId: phaseId || null,
    };
    if (resource) updateResource(resource.id, input);
    else addResource(input);
  };

  return (
    <form noValidate onSubmit={submit}>
      <h2 id={DIALOG_TITLE}>{isNew ? 'Add Resource' : 'Edit Resource'}</h2>
      <label className="field">
        <span>Resource URL</span>
        <input
          id="rUrl"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
        />
        <small>Optional. We'll try to detect the title and type from the link.</small>
      </label>
      <label className="field">
        <span>Title</span>
        <input
          id="rTitle"
          type="text"
          maxLength={160}
          value={title}
          placeholder="e.g. SwiftUI Crash Course for Beginners"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <fieldset className="field">
        <legend>Resource Type</legend>
        <div className="type-cards">
          {RESOURCE_TYPES.map((t) => (
            <label key={t} className="type-card">
              <input
                type="radio"
                name="rType"
                value={t}
                checked={type === t}
                onChange={() => {
                  touched.current.type = true;
                  applyType(t);
                }}
              />
              <TypeIcon type={t} size={24} />
              <span>{TYPES[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Estimated Time</span>
        <span className="suffixed">
          <input
            id="rHours"
            type="number"
            inputMode="decimal"
            min={0.25}
            step={0.25}
            value={hours}
            onChange={(e) => {
              touched.current.time = true;
              setHours(e.target.value);
            }}
          />
          <span aria-hidden="true">hours</span>
        </span>
      </label>
      {phases.length > 0 && (
        <label className="field">
          <span>
            Phase <small>(optional)</small>
          </span>
          <select id="rPhase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">No phase</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <small>Leave empty to keep it unorganized.</small>
        </label>
      )}
      <label className="field">
        <span>
          Notes <small>(optional)</small>
        </span>
        <textarea
          rows={3}
          maxLength={500}
          value={notes}
          placeholder="Add key takeaways or why this resource matters…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {isNew ? 'Add Resource' : 'Save'}
        </button>
      </div>
    </form>
  );
}
