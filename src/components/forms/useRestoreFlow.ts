import { useRef, useState } from 'react';
import { previewImport, type ImportErrorKind, type ImportPreview } from '../../domain/schema';
import { useStore } from '../../state/store';

/** Why a file was turned away: not a .json file, unreadable, not JSON, or rejected by `previewImport()`. */
export type RestoreFailure = ImportErrorKind | 'json' | 'read' | 'type';

/**
 * Import steps. Only `restoring` touches saved data: after the user chose to add the
 * file's plans. This state lives in the component and is never persisted.
 */
export type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string }
  | { step: 'invalid'; fileName: string; reason: RestoreFailure; detail: string }
  | { step: 'review'; fileName: string; preview: ImportPreview }
  | { step: 'restoring' | 'error'; fileName: string; preview: ImportPreview }
  | { step: 'success'; unshared: string[] };

export type RestoreFlow = ReturnType<typeof useRestoreFlow>;

/** Only JSON files can be imported; pickers and drops are filtered by this one check. */
const isJsonFile = (f: File) =>
  f.name.toLowerCase().endsWith('.json') || f.type === 'application/json';

export function useRestoreFlow() {
  const [state, setState] = useState<RestoreState>({ step: 'idle' });
  // Ignores a slow read when another file was picked, or the flow was cancelled, meanwhile.
  const readSeq = useRef(0);

  const fail = (fileName: string, reason: RestoreFailure, detail: string) =>
    setState({ step: 'invalid', fileName, reason, detail });

  const check = (file: File) => {
    const seq = ++readSeq.current;
    const fileName = file.name;
    if (!isJsonFile(file))
      return fail(fileName, 'type', 'Only .json files can be imported. Choose a plan file.');
    setState({ step: 'validating', fileName });
    const rd = new FileReader();
    rd.onload = () => {
      if (seq !== readSeq.current) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(rd.result ?? ''));
      } catch {
        return fail(fileName, 'json', 'The file is damaged or is not a Road to Goals plan file.');
      }
      const r = previewImport(raw);
      if (!r.ok) return fail(fileName, r.kind, r.error);
      setState({ step: 'review', fileName, preview: r.preview });
    };
    rd.onerror = () => {
      if (seq === readSeq.current)
        fail(fileName, 'read', 'Your browser could not read this file. Try choosing it again.');
    };
    rd.readAsText(file);
  };

  /** Adds the checked file's plans next to the saved ones, and reports success only once the backend confirms. */
  const add = async () => {
    if (state.step !== 'review' && state.step !== 'error') return;
    const { fileName, preview } = state;
    setState({ step: 'restoring', fileName, preview });
    let unshared: string[] = [];
    const ok = await useStore
      .getState()
      .addPlans(preview.data, preview.shares, (names) => (unshared = names));
    setState(ok ? { step: 'success', unshared } : { step: 'error', fileName, preview });
  };

  const reset = () => {
    readSeq.current++;
    setState({ step: 'idle' });
  };

  return { state, check, reset, add };
}
