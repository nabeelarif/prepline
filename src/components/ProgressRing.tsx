import type { ReactNode } from 'react';

interface Props {
  pct: number;
  size: number;
  stroke: number;
  /** CSS colour for the filled arc. */
  color?: string;
  children?: ReactNode;
  label?: string;
}

/** Circular progress with a rounded arc; the arc animates when `pct` changes. */
export function ProgressRing({ pct, size, stroke, color = 'var(--good)', children, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="pring"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={stroke}
        />
        {p > 0 && (
          <circle
            className="pring-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p / 100)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {children && <div className="pring-body">{children}</div>}
    </div>
  );
}
