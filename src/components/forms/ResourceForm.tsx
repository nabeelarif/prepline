import { useMemo, useRef, useState, type FormEvent } from 'react';
import { DEFAULT_MINUTES, RESOURCE_TYPES, TYPES } from '../../domain/constants';
import { fmtMin, pl } from '../../domain/format';
import { parseSections } from '../../domain/sections';
import type { Resource, ResourceType } from '../../domain/types';
import { detectType, normUrl, safeUrl, titleFromUrl } from '../../domain/urls';
import { useStore } from '../../state/store';

/** Add a resource to the active goal (resource is null) or edit one. */
export function ResourceForm({ resource }: { resource: Resource | null }) {
  const { addResource, updateResource, closeOverlay } = useStore.getState();
  const isNew = !resource;
  const initMin = resource?.minutes ?? DEFAULT_MINUTES.article;

  const [url, setUrl] = useState(resource?.url ?? '');
  const [title, setTitle] = useState(resource?.title ?? '');
  const [type, setType] = useState<ResourceType>(resource?.type ?? 'article');
  const [h, setH] = useState(String(Math.floor(initMin / 60)));
  const [m, setM] = useState(String(initMin % 60));
  const [secText, setSecText] = useState(
    resource?.sections.map((s) => `${s.title}, ${fmtMin(s.minutes)}`).join('\n') ?? '',
  );
  const [notes, setNotes] = useState(resource?.notes ?? '');
  const [error, setError] = useState('');
  // Fields the user has set by hand stop being auto-filled from the URL.
  const touched = useRef({ type: !isNew, time: !isNew });
  const autoTitle = useRef('');

  const setTime = (min: number) => {
    setH(String(Math.floor(min / 60)));
    setM(String(min % 60));
  };
  const isCourse = type === 'course';
  const secs = useMemo(() => (isCourse ? parseSections(secText) : []), [isCourse, secText]);
  const secTotal = secs.reduce((a, x) => a + x.minutes, 0);

  const onUrl = (v: string) => {
    setUrl(v);
    const u = normUrl(v);
    if (!safeUrl(u)) return;
    let t = type;
    if (!touched.current.type) {
      t = detectType(u);
      setType(t);
    }
    if (!title.trim() || title === autoTitle.current) {
      autoTitle.current = titleFromUrl(u);
      setTitle(autoTitle.current);
    }
    if (!touched.current.time) setTime(DEFAULT_MINUTES[t]);
  };

  const onType = (t: ResourceType) => {
    touched.current.type = true;
    setType(t);
    if (!touched.current.time) setTime(DEFAULT_MINUTES[t]);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const u = normUrl(url);
    const finalTitle = title.trim() || (safeUrl(u) ? titleFromUrl(u) : '');
    if (!finalTitle) {
      setError('Add a title so you can recognize this later.');
      e.currentTarget.querySelector<HTMLElement>('#rTitle')?.focus();
      return;
    }
    let sections = isCourse ? parseSections(secText) : [];
    if (resource) {
      // Keep progress on sections whose title did not change.
      const old = new Map(resource.sections.map((s) => [s.title.toLowerCase(), s]));
      sections = sections.map((s) => {
        const o = old.get(s.title.toLowerCase());
        return o ? { ...s, id: o.id, done: o.done, doneAt: o.doneAt } : s;
      });
    }
    let minutes = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    if (sections.length) minutes = sections.reduce((a, x) => a + x.minutes, 0);
    if (minutes <= 0) minutes = DEFAULT_MINUTES[type];
    const input = {
      url: u,
      title: finalTitle.slice(0, 160),
      type,
      minutes,
      notes: notes.trim(),
      sections,
    };
    if (resource) updateResource(resource.id, input);
    else addResource(input);
  };

  return (
    <form noValidate onSubmit={submit}>
      <h2>{isNew ? 'Add resource' : 'Edit resource'}</h2>
      <label className="field">
        <span>Link</span>
        <input
          id="rUrl"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a URL from YouTube, Udemy, a blog…"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
        />
        <small>Type and title fill in from the link. Change them if they are off.</small>
      </label>
      <label className="field">
        <span>Title</span>
        <input
          id="rTitle"
          type="text"
          maxLength={160}
          value={title}
          placeholder="What is it called?"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="row2">
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => onType(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((k) => (
              <option key={k} value={k}>
                {TYPES[k]}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Estimated time</span>
          <div className="dur">
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              aria-label="Hours"
              value={h}
              disabled={secs.length > 0}
              onChange={(e) => {
                touched.current.time = true;
                setH(e.target.value);
              }}
            />
            <span className="muted">h</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              aria-label="Minutes"
              value={m}
              disabled={secs.length > 0}
              onChange={(e) => {
                touched.current.time = true;
                setM(e.target.value);
              }}
            />
            <span className="muted">m</span>
          </div>
        </div>
      </div>
      {isCourse && (
        <label className="field">
          <span>
            Sections <small>optional</small>
          </span>
          <textarea
            rows={5}
            value={secText}
            placeholder={'Networking layer, 2h\nCaching and offline, 1h 30m\nMock interview, 45m'}
            onChange={(e) => setSecText(e.target.value)}
          />
          <small>
            {secs.length
              ? `${pl(secs.length, 'section')} · ${fmtMin(secTotal)} total. This replaces the estimated time.`
              : 'One per line, with a time at the end. Each section gets its own checkbox and counts toward progress.'}
          </small>
        </label>
      )}
      <label className="field">
        <span>
          Notes <small>optional</small>
        </span>
        <textarea
          className="plain"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <p className="msg err" role="alert">
        {error}
      </p>
      <div className="sheet-actions">
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={closeOverlay}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {isNew ? 'Add to plan' : 'Save'}
        </button>
      </div>
    </form>
  );
}
