import { useRef, useState } from 'react';
import { previewImport, type ImportErrorKind, type ImportPreview } from '../../domain/schema';
import { useStore } from '../../state/store';

/** Why a file was turned away: unreadable, not JSON, or rejected by `previewImport()`. */
export type RestoreFailure = ImportErrorKind | 'json' | 'read';

/**
 * Restore steps. Only `restoring` touches saved data, and only after the user
 * confirmed. This state lives in the component and is never persisted.
 */
export type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string }
  | { step: 'invalid'; fileName: string; reason: RestoreFailure; detail: string }
  | {
      step: 'review' | 'confirming' | 'restoring' | 'error';
      fileName: string;
      preview: ImportPreview;
    }
  | { step: 'success' };

export type RestoreFlow = ReturnType<typeof useRestoreFlow>;

export function useRestoreFlow() {
  const [state, setState] = useState<RestoreState>({ step: 'idle' });
  // Ignores a slow read when another file was picked, or the flow was cancelled, meanwhile.
  const readSeq = useRef(0);

  const fail = (fileName: string, reason: RestoreFailure, detail: string) =>
    setState({ step: 'invalid', fileName, reason, detail });

  const check = (file: File) => {
    const seq = ++readSeq.current;
    const fileName = file.name;
    setState({ step: 'validating', fileName });
    const rd = new FileReader();
    rd.onload = () => {
      if (seq !== readSeq.current) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(rd.result ?? ''));
      } catch {
        return fail(fileName, 'json', 'The file is damaged or is not a Prepline backup.');
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

  const withPreview = (step: 'review' | 'confirming') =>
    setState((s) => ('preview' in s ? { ...s, step } : s));

  const restore = () => {
    if (!('preview' in state) || (state.step !== 'confirming' && state.step !== 'error')) return;
    setState({ ...state, step: 'restoring' });
    const ok = useStore.getState().restoreBackup(state.preview.data);
    setState(ok ? { step: 'success' } : { ...state, step: 'error' });
  };

  const reset = () => {
    readSeq.current++;
    setState({ step: 'idle' });
  };

  return {
    state,
    check,
    reset,
    restore,
    confirm: () => withPreview('confirming'),
    backToReview: () => withPreview('review'),
  };
}
