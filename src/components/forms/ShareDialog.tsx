import { useState, type FormEvent } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { sharingArgs, type SharingValue } from '../../domain/share';
import type { Goal } from '../../domain/types';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';
import { SharingFields } from './SharingFields';

/** The full link to a shared plan, on this site. */
const linkTo = (slug: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${paths.shared(slug)}`;

/** Choose who can open a plan. Only the plan is shared, never progress, dates or daily hours. */
export function ShareDialog({ goal }: { goal: Goal }) {
  const { setPlanSharing, closeOverlay } = useStore.getState();
  const sharing = useStore((s) => s.sharing);
  const current = sharing.plans[goal.id];
  const [value, setValue] = useState<SharingValue>({
    visibility: current?.visibility ?? 'private',
    tags: (current?.tags ?? []).join(', '),
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = current?.slug && current.visibility !== 'private' ? linkTo(current.slug) : '';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSaved('');
    setSaving(true);
    const problem = await setPlanSharing(goal.id, ...sharingArgs(value));
    setSaving(false);
    if (problem) setError(problem);
    else setSaved(value.visibility === 'private' ? 'Sharing is off.' : 'Sharing settings saved.');
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('Could not copy. Select the link and copy it.');
    }
  };

  if (sharing.status === 'error') {
    return (
      <div>
        <h2 id={DIALOG_TITLE} className="sheet-title">
          <Share2 aria-hidden="true" /> Share plan
        </h2>
        <p className="msg err" role="alert">
          Sharing is not available right now. Try again later.
        </p>
        <div className="sheet-actions">
          <span className="spacer" />
          <button className="btn" onClick={closeOverlay}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit}>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <Share2 aria-hidden="true" /> Share {goal.name}
      </h2>
      <SharingFields
        value={value}
        onChange={(next) => {
          setValue(next);
          setSaved('');
          setError('');
        }}
      />
      {link && (
        <div className="share-link">
          <input readOnly aria-label="Link to this plan" value={link} />
          <button type="button" className="btn" onClick={copy}>
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}{' '}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
      {current?.hidden && (
        <p className="msg err" role="alert">
          This plan was taken down after a report, so nobody can open it right now.
        </p>
      )}
      <p className="msg err" role="alert">
        {error}
      </p>
      <p className="msg" role="status">
        {saved}
      </p>
      <div className="sheet-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Done
        </button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
