import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore, type ImportTab } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';
import { PasteCard } from './PasteCard';
import { RestoreCard, RestoreFlowPanel } from './RestoreCard';
import { useRestoreFlow } from './useRestoreFlow';

const TABS: [ImportTab, string][] = [
  ['paste', 'Paste plan'],
  ['file', 'From a file'],
];

/** Import plans from pasted text or a .json file, for example one an AI wrote. */
export function DataPanel({ initial = 'file' }: { initial?: ImportTab }) {
  const navigate = useNavigate();
  const flow = useRestoreFlow((planId) => {
    useStore.getState().closeOverlay();
    useStore.getState().showToast('Plan added');
    navigate(paths.plan(planId));
  });
  const [tab, setTab] = useState(initial);
  // Kept here so the pasted text is still there after Cancel or a failed check.
  const [pasted, setPasted] = useState('');
  const { step } = flow.state;
  // Once a plan checks out, the import steps take the whole modal.
  const importing = !['idle', 'validating', 'invalid'].includes(step);
  // The card that comes back after those steps takes focus, as the button used is gone.
  const [returning, setReturning] = useState(false);
  if (importing && !returning) setReturning(true);

  return (
    <>
      <header className="backup-head">
        <span className="tile accent round" aria-hidden="true">
          <FileUp size={26} />
        </span>
        <div>
          <h2 id={DIALOG_TITLE}>Import plans</h2>
          <p className="muted">
            Add plans in Road to Goals format, such as one your AI wrote for you.
          </p>
        </div>
      </header>

      {importing ? (
        <RestoreFlowPanel flow={flow} />
      ) : (
        <>
          <div className="seg import-tabs" role="group" aria-label="Import from">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => {
                  if (id === tab) return;
                  flow.reset();
                  setTab(id);
                  // Focus stays on the tab just picked.
                  setReturning(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'paste' ? (
            <PasteCard flow={flow} text={pasted} onText={setPasted} takeFocus={returning} />
          ) : (
            <RestoreCard flow={flow} takeFocus={returning} />
          )}
        </>
      )}
    </>
  );
}
