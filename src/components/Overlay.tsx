import { useEffect, useRef, type ReactNode } from 'react';
import { useStore } from '../state/store';

/**
 * Modal sheet. Focuses its first field on open, closes on Escape or a backdrop
 * click, locks page scroll, and returns focus to the opener on close.
 */
export function Overlay({ children }: { children: ReactNode }) {
  const close = useStore((s) => s.closeOverlay);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.classList.add('locked');
    sheet.current?.querySelector<HTMLElement>('input:not([type=file]),textarea,select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
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
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" ref={sheet}>
        {children}
      </div>
    </div>
  );
}
