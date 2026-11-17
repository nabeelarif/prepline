import { FileUp } from 'lucide-react';
import { DIALOG_TITLE } from '../Overlay';
import { RestoreCard, RestoreFlowPanel } from './RestoreCard';
import { useRestoreFlow } from './useRestoreFlow';

/** Import plans from a .json file, for example one an AI agent wrote. */
export function DataPanel() {
  const flow = useRestoreFlow();
  // Once a file checks out, the import steps take the whole modal.
  const importing = !['idle', 'validating', 'invalid'].includes(flow.state.step);

  return (
    <>
      <header className="backup-head">
        <span className="tile accent round" aria-hidden="true">
          <FileUp size={26} />
        </span>
        <div>
          <h2 id={DIALOG_TITLE}>Import plans</h2>
          <p className="muted">
            Add plans from a Road to Goals .json file, such as one an AI agent created for you.
          </p>
        </div>
      </header>

      {importing ? <RestoreFlowPanel flow={flow} /> : <RestoreCard flow={flow} />}
    </>
  );
}
