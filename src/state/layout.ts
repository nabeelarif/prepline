import { create } from 'zustand';

/**
 * Which dashboard sections are folded away. A per-browser preference like the theme:
 * not part of AppData, backups or the backend.
 */
export type Section = 'journey';

const KEY = 'roadtogoals:layout';

function load(): Record<Section, boolean> {
  const hidden = { journey: false };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Section, unknown>>;
    return { journey: raw.journey === true };
  } catch {
    return hidden;
  }
}

interface LayoutState {
  collapsed: Record<Section, boolean>;
  toggle(section: Section): void;
}

export const useLayout = create<LayoutState>((set, get) => ({
  collapsed: load(),
  toggle: (section) => {
    const collapsed = { ...get().collapsed, [section]: !get().collapsed[section] };
    set({ collapsed });
    try {
      localStorage.setItem(KEY, JSON.stringify(collapsed));
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  },
}));
