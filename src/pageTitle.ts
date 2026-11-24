/**
 * The browser tab title: the current page, with the study timer's clock in front while it
 * runs. Both parts live here so a page change and a clock tick never overwrite each other.
 */
export const SITE_NAME = 'Road to Goals';

let base = typeof document === 'undefined' ? SITE_NAME : document.title;
let prefix = '';

function apply() {
  document.title = prefix ? `${prefix} · ${base}` : base;
}

/** `Page · Road to Goals`, or just the site name for the home page. */
export function setPageTitle(page?: string) {
  base = page ? `${page} · ${SITE_NAME}` : SITE_NAME;
  apply();
}

/** The running timer's clock, or '' to clear it. */
export function setTitlePrefix(next: string) {
  prefix = next;
  apply();
}
