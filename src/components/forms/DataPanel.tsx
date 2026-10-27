import { useState } from 'react';
import { todayISO } from '../../domain/dates';
import { previewImport, type ImportPreview } from '../../domain/schema';
import { pl } from '../../domain/format';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';
import { DIALOG_TITLE } from '../Overlay';

interface Msg {
  text: string;
  err?: boolean;
}

/** Export, import, and reset. Importing replaces all saved data. */
export function DataPanel() {
  const data = useStore((s) => s.data);
  const { importData, resetAll, closeOverlay } = useStore.getState();
  const json = JSON.stringify(data, null, 2);
  const [copyMsg, setCopyMsg] = useState('');
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<Msg>({ text: '' });
  const [preview, setPreview] = useState<ImportPreview | null>(null);

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
      setImportMsg({ text: `Loaded ${f.name}. Press Check backup to review it.` });
      setPreview(null);
    };
    rd.onerror = () =>
      setImportMsg({
        text: 'That file could not be read. Try pasting its contents instead.',
        err: true,
      });
    rd.readAsText(f);
  };

  // Step one: check the backup and show what it holds. Step two replaces the data.
  const check = () => {
    setPreview(null);
    let raw: unknown;
    try {
      raw = JSON.parse(importText);
    } catch {
      return setImportMsg({
        text: 'That is not valid JSON. Paste the whole backup, from the first { to the last }.',
        err: true,
      });
    }
    const r = previewImport(raw);
    if (!r.ok) return setImportMsg({ text: r.error, err: true });
    setImportMsg({ text: '' });
    setPreview(r.preview);
  };

  return (
    <>
      <h2 id={DIALOG_TITLE}>Backup and restore</h2>
      <p className="muted">
        Prepline saves your plans in this browser's local storage. It is not synced across devices,
        and clearing site data erases it, so export a backup now and then. A backup also moves your
        plans to another browser.
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
        onChange={(e) => {
          setImportText(e.target.value);
          setPreview(null);
        }}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={check} disabled={!importText.trim()}>
          Check backup
        </button>
        <p className={`msg${importMsg.err ? ' err' : ''}`} role="alert">
          {importMsg.text}
        </p>
      </div>
      {preview && (
        <div className="import-preview" role="region" aria-label="Backup contents">
          <p>
            <strong>
              {pl(preview.plans, 'plan')}, {pl(preview.resources, 'resource')},{' '}
              {pl(preview.phases, 'phase')}
            </strong>
          </p>
          {preview.notes.length > 0 && (
            <ul>
              {preview.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="muted">This replaces everything saved in this browser.</p>
          <div className="btn-row">
            <ConfirmButton
              className="btn sm primary"
              confirmText="Click again to replace"
              onConfirm={() => importData(preview.data)}
            >
              Replace all data
            </ConfirmButton>
            <button className="btn sm ghost" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <h3>Start over</h3>
      <div className="btn-row">
        <ConfirmButton
          className="btn danger sm"
          confirmText="Erase every plan?"
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
