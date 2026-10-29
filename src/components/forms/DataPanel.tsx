import { useEffect, useState } from 'react';
import { Database, Download, ListChecks } from 'lucide-react';
import { backupFileName, serializeBackup } from '../../domain/backup';
import { useStore } from '../../state/store';
import { DIALOG_TITLE } from '../Overlay';
import { DeleteAllData } from './DeleteAllData';
import { RestoreCard, RestoreFlowPanel } from './RestoreCard';
import { useRestoreFlow } from './useRestoreFlow';

interface Msg {
  text: string;
  err?: boolean;
}

/** Download a backup, restore one from a file, or delete everything. */
export function DataPanel() {
  const flow = useRestoreFlow();
  const [msg, setMsg] = useState<Msg>({ text: '' });
  // Once a file checks out, the restore steps take the whole modal.
  const restoring = !['idle', 'validating', 'invalid'].includes(flow.state.step);

  useEffect(() => {
    if (!msg.text || msg.err) return;
    const t = setTimeout(() => setMsg({ text: '' }), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  // The browser handles the file from here, so this only says the download started.
  const download = () => {
    try {
      const json = serializeBackup(useStore.getState().data);
      const u = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
      setMsg({ text: 'Your backup download has started.' });
    } catch {
      setMsg({
        text: 'This browser blocked the download. Try again or use another browser.',
        err: true,
      });
    }
  };

  return (
    <>
      <header className="backup-head">
        <span className="tile accent round" aria-hidden="true">
          <Database size={26} />
        </span>
        <div>
          <h2 id={DIALOG_TITLE}>Backup and Restore</h2>
          <p className="muted">
            Keep your preparation data safe. Download a backup or restore one on this or another
            device.
          </p>
        </div>
      </header>

      {restoring ? (
        <RestoreFlowPanel flow={flow} />
      ) : (
        <>
          <div className="backup-grid">
            <section className="backup-card download" aria-labelledby="downloadTitle">
              <div className="backup-card-head">
                <span className="tile good" aria-hidden="true">
                  <Download size={26} />
                </span>
                <div>
                  <h3 id="downloadTitle">Download Backup</h3>
                  <p className="muted">
                    Save all your plans, phases, resources, and progress in one file.
                  </p>
                </div>
              </div>
              <div className="backup-includes">
                <ListChecks size={20} aria-hidden="true" />
                <p>
                  <strong>Includes everything</strong>
                  <br />
                  <span className="muted">All plans, phases, resources and study progress.</span>
                </p>
              </div>
              <button type="button" className="btn primary wide-btn" onClick={download}>
                <Download size={18} aria-hidden="true" /> Download Backup
              </button>
              <p className={`msg${msg.err ? ' err' : ''}`} role={msg.err ? 'alert' : 'status'}>
                {msg.text}
              </p>
            </section>
            <RestoreCard flow={flow} />
          </div>
          <DeleteAllData />
        </>
      )}
    </>
  );
}
