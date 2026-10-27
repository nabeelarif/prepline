export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** "1 day", "3 days". */
export function pl(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** 45 → "45m", 90 → "1h 30m", 120 → "2h". */
export function fmtMin(m: number): string {
  m = Math.round(m);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Minutes as hours, one decimal under 10h: 30 → "30m", 90 → "1.5h", 720 → "12h". */
export function fmtHours(m: number): string {
  m = Math.round(m);
  if (m > 0 && m < 60) return `${m}m`;
  const h = m / 60;
  return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`;
}

/** Clamp to [min, max]; non-numbers and values <= 0 become def. */
export function num(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.max(min, n));
}
