import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Label shown after the first click, e.g. "Delete?". */
  confirmText: string;
  onConfirm(): void;
  children: ReactNode;
}

/** Destructive button: the first click arms it, a second click within 4 seconds confirms. */
export function ConfirmButton({ confirmText, onConfirm, children, ...rest }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      {...rest}
      data-armed={armed ? '1' : undefined}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}
