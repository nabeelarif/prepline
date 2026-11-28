import { useEffect, useRef, useState } from 'react';
import { readPlanText } from '../../domain/planText';
import type { ImportErrorKind, ImportPreview } from '../../domain/schema';
import { useStore, type ImportTab } from '../../state/store';

/** Why a plan was turned away: not a .json file, unreadable, not JSON, or rejected by `previewImport()`. */
export type RestoreFailure = ImportErrorKind | 'json' | 'read' | 'type';

/** Where the plan came from: a chosen file, with its name, or text pasted from an AI. */
export type ImportSource =
  { kind: Extract<ImportTab, 'file'>; fileName: string } | { kind: Extract<ImportTab, 'paste'> };

/**
 * Import steps. Only `restoring` touches saved data: after the user chose to add the
 * plans. This state lives in the component and is never persisted.
 */
export type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string }
  | { step: 'invalid'; source: ImportSource; reason: RestoreFailure; errors: string[] }
  | { step: 'review'; source: ImportSource; preview: ImportPreview }
  | { step: 'restoring' | 'error'; source: ImportSource; preview: ImportPreview }
  | { step: 'success'; unshared: string[] };

export type RestoreFlow = ReturnType<typeof useRestoreFlow>;

/** Only JSON files can be imported; pickers and drops are filtered by this one check. */
const isJsonFile = (f: File) =>
  f.name.toLowerCase().endsWith('.json') || f.type === 'application/json';

const closedOutcome = (unshared: string[]) =>
  unshared.length
    ? `Plans added, but sharing could not be turned on for ${unshared.map((n) => `"${n}"`).join(', ')}. Still private.`
    : 'Plans added to My Plans';

/** `onPasted` runs after a pasted plan is saved and fully shared, with the new plan's id. */
export function useRestoreFlow(onPasted: (planId: string) => void) {
  const [state, setState] = useState<RestoreState>({ step: 'idle' });
  // Ignores a slow read when another file was picked, or the flow was cancelled, meanwhile.
  const readSeq = useRef(0);
  // False once the dialog is closed, which can happen while the plans are being saved.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  const fail = (source: ImportSource, reason: RestoreFailure, errors: string[]) =>
    setState({ step: 'invalid', source, reason, errors });

  /** Files and pasted text go through the same checks. */
  const read = (source: ImportSource, text: string) => {
    const r = readPlanText(text);
    if (!r.ok) return fail(source, r.kind, r.errors);
    setState({ step: 'review', source, preview: r.preview });
  };

  const check = (file: File) => {
    const seq = ++readSeq.current;
    const source: ImportSource = { kind: 'file', fileName: file.name };
    if (!isJsonFile(file))
      return fail(source, 'type', ['Only .json files can be imported. Choose a plan file.']);
    setState({ step: 'validating', fileName: file.name });
    const rd = new FileReader();
    rd.onload = () => {
      if (seq === readSeq.current) read(source, String(rd.result ?? ''));
    };
    rd.onerror = () => {
      if (seq === readSeq.current)
        fail(source, 'read', ['Your browser could not read this file. Try choosing it again.']);
    };
    rd.readAsText(file);
  };

  const checkText = (text: string) => {
    readSeq.current++;
    read({ kind: 'paste' }, text);
  };

  /** Adds the checked plans next to the saved ones, and reports success only once the backend confirms. */
  const add = async () => {
    if (state.step !== 'review' && state.step !== 'error') return;
    const { source, preview } = state;
    setState({ step: 'restoring', source, preview });
    const result = await useStore.getState().addPlans(preview.data, preview.shares);
    if (!open.current) {
      // Nobody is on this dialog now, so a toast says how it went and no page changes. A
      // failed save has already shown its own.
      if (result) useStore.getState().showToast(closedOutcome(result.unshared));
      return;
    }
    if (!result) return setState({ step: 'error', source, preview });
    const { addedIds, unshared } = result;
    const [first] = addedIds;
    // A sharing failure has to be seen, so that case stays on the result screen.
    if (source.kind === 'paste' && first && !unshared.length) return onPasted(first);
    setState({ step: 'success', unshared });
  };

  const reset = () => {
    readSeq.current++;
    setState({ step: 'idle' });
  };

  return { state, check, checkText, reset, add };
}
