import { useRef, useState } from 'react';
import { previewImport, type ImportErrorKind, type ImportPreview } from '../../domain/schema';
import { useStore } from '../../state/store';

/** Why a file was turned away: unreadable, not JSON, or rejected by `previewImport()`. */
export type RestoreFailure = ImportErrorKind | 'json' | 'read';

/**
 * Restore steps. Only `restoring` touches saved data: after the user chose to add the
 * file's plans, or confirmed replacing everything. This state lives in the component
 * and is never persisted.
 */
export type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string }
  | { step: 'invalid'; fileName: string; reason: RestoreFailure; detail: string }
  | { step: 'review' | 'confirming'; fileName: string; preview: ImportPreview }
  | { step: 'restoring' | 'error'; fileName: string; preview: ImportPreview; mode: RestoreMode }
  | { step: 'success'; mode: RestoreMode };

/** Add the file's plans next to the saved ones, or replace all saved data with the file. */
export type RestoreMode = 'add' | 'replace';

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
    setState((s) => ('preview' in s ? { step, fileName: s.fileName, preview: s.preview } : s));

  /**
   * Applies the checked file. Adding is allowed straight from review because it
   * keeps saved data; replacing needs the confirmation step first. Retry after an
   * error repeats the same action.
   */
  const apply = (mode: RestoreMode) => {
    if (!('preview' in state)) return;
    const allowed =
      state.step === 'error'
        ? state.mode === mode
        : mode === 'add'
          ? state.step === 'review'
          : state.step === 'confirming';
    if (!allowed) return;
    const { fileName, preview } = state;
    setState({ step: 'restoring', fileName, preview, mode });
    const { addPlans, restoreBackup } = useStore.getState();
    const ok = (mode === 'add' ? addPlans : restoreBackup)(preview.data);
    setState(ok ? { step: 'success', mode } : { step: 'error', fileName, preview, mode });
  };

  const reset = () => {
    readSeq.current++;
    setState({ step: 'idle' });
  };

  return {
    state,
    check,
    reset,
    add: () => apply('add'),
    restore: () => apply('replace'),
    retry: () => {
      if (state.step === 'error') apply(state.mode);
    },
    confirm: () => withPreview('confirming'),
    backToReview: () => withPreview('review'),
  };
}
