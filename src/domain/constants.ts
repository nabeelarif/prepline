import type { PhaseColor, ResourceStatus, ResourceType } from './types';

export const TYPES: Record<ResourceType, string> = {
  read: 'Read',
  watch: 'Watch',
  listen: 'Listen',
  course: 'Course',
  practice: 'Practice',
  project: 'Project',
  workout: 'Workout',
  habit: 'Habit',
  task: 'Task',
  other: 'Other',
};
export const RESOURCE_TYPES = Object.keys(TYPES) as ResourceType[];

/** What each type covers, with examples; shown when hovering or focusing a type. */
export const TYPE_INFO: Record<ResourceType, { covers: string; examples: string }> = {
  read: {
    covers: 'Anything written.',
    examples: 'Article, book, docs, paper, recipe, guide',
  },
  watch: {
    covers: 'Video or live sessions.',
    examples: 'YouTube, talk, cooking demo, workout video',
  },
  listen: {
    covers: 'Audio.',
    examples: 'Podcast, audiobook, language audio',
  },
  course: {
    covers: 'A structured, multi-part program.',
    examples: 'Udemy, Coursera, a 30-day program',
  },
  practice: {
    covers: 'Repeated drills and exercises.',
    examples: 'Coding problems, scales, vocabulary, stretching',
  },
  project: {
    covers: 'Making or building something.',
    examples: 'Side project, cook a full meal, DIY, essay',
  },
  workout: {
    covers: 'Physical activity.',
    examples: 'Run, gym session, yoga, walk',
  },
  habit: {
    covers: 'Something done daily or on a schedule. Estimate the total time over the plan.',
    examples: 'Drink 3L water, no sugar, sleep by 10pm, meditate',
  },
  task: {
    covers: 'A one-off to-do.',
    examples: 'Book a doctor visit, buy ingredients, renew passport',
  },
  other: {
    covers: "Anything that doesn't fit the types above.",
    examples: 'Anything else',
  },
};

/** One-line description of a type: what it covers, with examples. */
export const typeHint = (t: ResourceType) => `${TYPE_INFO[t].covers} e.g. ${TYPE_INFO[t].examples}`;

/** Older files and data used these names; they map onto the current types. */
export const LEGACY_TYPES: Record<string, ResourceType> = {
  article: 'read',
  video: 'watch',
};

/** Default estimate in minutes when a resource is added without one. */
export const DEFAULT_MINUTES: Record<ResourceType, number> = {
  read: 30,
  watch: 30,
  listen: 30,
  course: 120,
  practice: 45,
  project: 120,
  workout: 45,
  habit: 10,
  task: 5,
  other: 30,
};

export const STATUS_TEXT: Record<ResourceStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const PHASE_COLORS: PhaseColor[] = [
  'blue',
  'purple',
  'green',
  'orange',
  'red',
  'pink',
  'gray',
];

/** The range a plan's daily study hours are kept in. */
export const MIN_HOURS_PER_DAY = 0.25;
export const MAX_HOURS_PER_DAY = 16;

/** Roadmap steps shown before "View full journey". */
export const JOURNEY_LIMIT = 10;
