import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Where a dragged item lands: next to `targetId`, before or after it. */
export type Place = (id: string, targetId: string, after: boolean) => void;

interface Drag {
  id: string;
  from: number;
  /** Insertion index in the list without the dragged item. */
  to: number;
  /** Vertical offset from where the drag started, in page pixels. */
  dy: number;
}

const EDGE = 60;

/**
 * Pointer-based drag to reorder rows of a list (mouse and touch), plus arrow
 * keys on the handle. `ids` are the visible rows in order; each row element
 * must carry `data-reorder-id`, and any extra rows of the same item (such as a
 * notes line) `data-reorder-part` with the same id. Only the visible rows are considered, so a
 * filtered list still drops next to the row the user sees.
 */
export function useReorderDrag(ids: string[], place: Place) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = useRef<{ y: number; mids: number[] } | null>(null);

  const landing = (id: string, to: number): [string, boolean] | null => {
    const rest = ids.filter((x) => x !== id);
    if (!rest.length) return null;
    return to < rest.length ? [rest[to]!, false] : [rest[rest.length - 1]!, true];
  };

  const end = (commit: boolean) => {
    if (commit && drag && drag.to !== drag.from) {
      const spot = landing(drag.id, drag.to);
      if (spot) place(drag.id, ...spot);
    }
    start.current = null;
    setDrag(null);
  };

  const handleProps = (id: string) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      const from = ids.indexOf(id);
      const list = e.currentTarget.closest('tbody, ul, ol');
      if (from < 0 || !list) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      // Item midpoints in page coordinates, so scrolling mid-drag stays accurate.
      const mids = ids.map((x) => {
        const top = list.querySelector(`[data-reorder-id="${x}"]`)?.getBoundingClientRect();
        if (!top) return 0;
        const part = list.querySelector(`[data-reorder-part="${x}"]`)?.getBoundingClientRect();
        return (top.top + (part ?? top).bottom) / 2 + window.scrollY;
      });
      start.current = { y: e.clientY + window.scrollY, mids };
      setDrag({ id, from, to: from, dy: 0 });
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || !drag) return;
      if (e.clientY < EDGE) window.scrollBy(0, -12);
      else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, 12);
      const y = e.clientY + window.scrollY;
      const to = s.mids.filter((m, i) => i !== drag.from && m < y).length;
      setDrag({ ...drag, to, dy: y - s.y });
    },
    onPointerUp: () => end(true),
    onPointerCancel: () => end(false),
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const i = ids.indexOf(id);
      const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
      if (j < 0 || j >= ids.length) return;
      e.preventDefault();
      place(id, ids[j]!, j > i);
      // Moving the row in the DOM can drop focus; put it back on the handle.
      const handle = e.currentTarget;
      requestAnimationFrame(() => handle.isConnected && handle.focus());
    },
  });

  /** Row state while dragging: the dragged row, or where the drop line shows. */
  const rowState = (id: string) => {
    if (!drag) return {};
    if (id === drag.id) return { dragging: true, dy: drag.dy };
    if (drag.to === drag.from) return {};
    const spot = landing(drag.id, drag.to);
    if (spot?.[0] !== id) return {};
    return { dropLine: spot[1] ? ('after' as const) : ('before' as const) };
  };

  return { active: drag !== null, handleProps, rowState };
}
