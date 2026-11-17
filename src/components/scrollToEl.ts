/** Scrolls an element into view, without animation for people who prefer reduced motion. */
export function scrollToEl(el: Element | null, block: ScrollLogicalPosition) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView?.({ block, behavior: reduce ? 'auto' : 'smooth' });
}
