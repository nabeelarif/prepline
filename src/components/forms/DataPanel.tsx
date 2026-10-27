import { useState } from 'react';
import { todayISO } from '../../domain/dates';
import { parseAppData } from '../../domain/schema';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';

interface Msg {
  text: string;
  err?: boolean;
}

/** Export, import, and reset. Importing replaces all saved data. */
export function DataPanel() {
  const data = useStore((s) => s.data);
  const { importData, loadSample, resetAll, closeOverlay } = useStore.getState();
  const json = JSON.stringify(data, null, 2);
  const [copyMsg, setCopyMsg] = useState('');
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<Msg>({ text: '' });

  const copy = (box: HTMLTextAreaElement | null) => {
    const fallback = () => {
      box?.focus();
      box?.select();
      setCopyMsg('Press Ctrl+C or ⌘C to copy the selected text.');
    };
    try {
      navigator.clipboard.writeText(json).then(() => setCopyMsg('Copied.'), fallback);
    } catch {
      fallback();
    }
  };

  const download = () => {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `prepline-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
    } catch {
      // Fall through to the hint below.
    }
    setCopyMsg('If no file was saved, use Copy JSON instead.');
  };

  const readFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      setImportText(String(rd.result ?? ''));
      setImportMsg({ text: `Loaded ${f.name}. Press Import to use it.` });
    };
    rd.onerror = () =>
      setImportMsg({
        text: 'That file could not be read. Try pasting its contents instead.',
        err: true,
      });
    rd.readAsText(f);
  };

  const doImport = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(importText);
    } catch {
      return setImportMsg({
        text: 'That is not valid JSON. Paste the whole backup, from the first { to the last }.',
        err: true,
      });
    }
    const parsed = parseAppData(raw);
    if (!parsed)
      return setImportMsg({
        text: 'This JSON has no "goals" list, so it is not a Prepline backup.',
        err: true,
      });
    importData(parsed);
  };

  return (
    <>
      <h2>Backup and restore</h2>
      <p className="muted">
        Prepline keeps your data in this browser only. Export a backup now and then, and use it to
        move your plan to another browser or device.
      </p>

      <h3>Export</h3>
      <textarea id="exportBox" rows={6} readOnly aria-label="Backup JSON" value={json} />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn sm"
          onClick={() => copy(document.querySelector<HTMLTextAreaElement>('#exportBox'))}
        >
          Copy JSON
        </button>
        <button className="btn sm" onClick={download}>
          Download .json
        </button>
        <p className="msg" role="status">
          {copyMsg}
        </p>
      </div>

      <h3>Import</h3>
      <p>Choose a backup file or paste its contents. Importing replaces everything saved here.</p>
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        onChange={(e) => readFile(e.target.files?.[0])}
      />
      <textarea
        rows={4}
        style={{ marginTop: 8 }}
        placeholder='{ "version": 1, "goals": [ … ] }'
        aria-label="Paste backup JSON"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <ConfirmButton className="btn sm" confirmText="Replace all data?" onConfirm={doImport}>
          Import
        </ConfirmButton>
        <p className={`msg${importMsg.err ? ' err' : ''}`} role="alert">
          {importMsg.text}
        </p>
      </div>

      <h3>Start over</h3>
      <div className="btn-row">
        <button className="btn sm" onClick={loadSample}>
          Add the sample goal
        </button>
        <ConfirmButton
          className="btn danger sm"
          confirmText="Erase every goal?"
          onConfirm={resetAll}
        >
          Erase all data
        </ConfirmButton>
      </div>

      <div className="sheet-actions">
        <span className="spacer" />
        <button className="btn primary" onClick={closeOverlay}>
          Done
        </button>
      </div>
    </>
  );
}
