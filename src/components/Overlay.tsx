import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../state/store';

/** Id that each overlay's heading uses, so the dialog is named by it. */
export const DIALOG_TITLE = 'dlgTitle';

const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet. Focuses its first field on open, keeps Tab inside, closes on Escape
 * or a backdrop click, locks page scroll, and returns focus to the opener on close.
 * Content that handles Escape itself (an inner confirmation) calls preventDefault().
 */
export function Overlay({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const close = useStore((s) => s.closeOverlay);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.classList.add('locked');
    const first =
      sheet.current?.querySelector<HTMLElement>(
        'input:not([type=file]):not([type=radio]),textarea,select',
      ) ?? sheet.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
      if (e.key !== 'Tab' || !sheet.current) return;
      const list = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const a = list[0];
      const z = list[list.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z?.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      if (opener?.isConnected) opener.focus();
    };
  }, [close]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={wide ? 'sheet wide' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE}
        ref={sheet}
      >
        <button type="button" className="icon-btn sheet-close" aria-label="Close" onClick={close}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
