import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ClipboardPaste, Copy } from 'lucide-react';
import { fixItMessage } from '../../domain/planText';
import { useStepFocus } from '../../hooks/useStepFocus';
import { useStore } from '../../state/store';
import { copyText } from '../copyText';
import { CopyFallback } from './CopyFallback';
import { ErrorList } from './ErrorList';
import type { RestoreFlow } from './useRestoreFlow';

const MANUAL_PASTE = 'Click in the box and press ⌘V or Ctrl+V (on a phone, touch and hold).';

/** Paste an AI's reply. Code fences and sentences around the JSON are fine. */
export function PasteCard({
  flow,
  text,
  onText,
  takeFocus,
}: {
  flow: RestoreFlow;
  text: string;
  onText: (text: string) => void;
  takeFocus: boolean;
}) {
  const { state, checkText, reset } = flow;
  const box = useRef<HTMLTextAreaElement>(null);
  const [clipboardNote, setClipboardNote] = useState('');
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const errors = state.step === 'invalid' && state.source.kind === 'paste' ? state.errors : null;

  // Move to the errors when a check fails, so they are seen and read out.
  const errorHeading = useStepFocus(errors);
  useEffect(() => setCopied('no'), [errors]);

  const fromClipboard = async () => {
    let clip = '';
    try {
      clip = await navigator.clipboard.readText();
    } catch {
      setClipboardNote(`Your browser didn’t allow reading the clipboard. ${MANUAL_PASTE}`);
      box.current?.focus();
      return;
    }
    if (!clip.trim()) {
      setClipboardNote('The clipboard is empty. Copy your AI’s reply first.');
      return;
    }
    setClipboardNote('');
    reset();
    onText(clip);
    box.current?.focus();
  };

  return (
    <form
      className="paste-card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        checkText(text);
      }}
    >
      <label className="field">
        <span>Your AI’s reply</span>
        <textarea
          ref={box}
          autoFocus={takeFocus}
          className="paste-box"
          rows={10}
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Paste the code box, or the whole reply."
          onChange={(e) => {
            setClipboardNote('');
            onText(e.target.value);
          }}
        />
      </label>
      <p className="msg" role="status">
        {clipboardNote}
      </p>

      {errors && (
        <div className="restore-invalid" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h3 ref={errorHeading} tabIndex={-1}>
              This plan can’t be imported yet.
            </h3>
            <ErrorList errors={errors} />
            <p className="muted">Nothing was changed. Your AI can fix this:</p>
            <button
              type="button"
              className="btn"
              onClick={() =>
                void copyText(fixItMessage(errors)).then((ok) => setCopied(ok ? 'yes' : 'failed'))
              }
            >
              <Copy size={16} aria-hidden="true" /> Copy fix-it message
            </button>
            <p className="msg" role="status">
              {copied === 'yes' ? 'Copied. Paste it into your AI’s chat.' : ''}
            </p>
            {copied === 'failed' && <CopyFallback text={fixItMessage(errors)} />}
          </div>
        </div>
      )}

      <div className="sheet-actions paste-actions">
        <button
          type="button"
          className="link-btn"
          onClick={() => useStore.getState().openOverlay({ kind: 'ai' })}
        >
          No plan yet? Use my own AI
        </button>
        <span className="spacer" />
        <button type="button" className="btn" onClick={fromClipboard}>
          <ClipboardPaste size={16} aria-hidden="true" /> Paste from clipboard
        </button>
        <button type="submit" className="btn primary">
          Import
        </button>
      </div>
    </form>
  );
}
