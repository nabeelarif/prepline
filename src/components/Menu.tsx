import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ConfirmButton } from './ConfirmButton';

export type MenuEntry =
  | {
      label: ReactNode;
      sub?: string;
      icon?: ReactNode;
      onSelect(): void;
      checked?: boolean;
      disabled?: boolean;
      danger?: boolean;
      /** Destructive: the first click arms the item, the second runs it. */
      confirm?: string;
    }
  | { heading: string }
  | 'divider';

interface Props {
  /** Accessible name for the trigger when its content is not enough. */
  label?: string;
  triggerClass: string;
  trigger: ReactNode;
  items: MenuEntry[];
  align?: 'start' | 'end';
  menuClass?: string;
}

/**
 * Button with a dropdown of actions. Closes on Escape (returning focus to the
 * trigger), an outside click, or after an item runs. Arrow keys move between items.
 */
export function Menu({ label, triggerClass, trigger, items, align = 'start', menuClass }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => [
      ...(wrap.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)') ?? []),
    ];
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        list[(next + list.length) % list.length]?.focus();
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    // Capture, so Escape closes the menu before an enclosing dialog sees it.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className={triggerClass}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div className={`menu menu-${align} ${menuClass ?? ''}`} role="menu" id={id}>
          {items.map((it, i) => {
            if (it === 'divider') return <hr key={i} />;
            if ('heading' in it)
              return (
                <p key={i} className="menu-heading" role="presentation">
                  {it.heading}
                </p>
              );
            const body = (
              <>
                {it.icon}
                <span className="menu-text">
                  <span>{it.label}</span>
                  {it.sub && <small>{it.sub}</small>}
                </span>
              </>
            );
            const cls = `menu-item${it.danger ? ' danger' : ''}`;
            if (it.confirm)
              return (
                <ConfirmButton
                  key={i}
                  role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={it.checked}
                  className={cls}
                  confirmText={it.confirm}
                  onConfirm={() => run(it.onSelect)}
                >
                  {body}
                </ConfirmButton>
              );
            return (
              <button
                key={i}
                type="button"
                role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={it.checked}
                className={cls}
                disabled={it.disabled}
                onClick={() => run(it.onSelect)}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
