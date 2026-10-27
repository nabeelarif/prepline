import type { PhaseColor, ResourceStatus, ResourceType } from './types';

export const STORAGE_KEY = 'prepline:v1';

export const TYPES: Record<ResourceType, string> = {
  video: 'Video',
  article: 'Article',
  course: 'Course',
  practice: 'Practice',
};
export const RESOURCE_TYPES = Object.keys(TYPES) as ResourceType[];

/** Default estimate in minutes when a resource is added without one. */
export const DEFAULT_MINUTES: Record<ResourceType, number> = {
  article: 30,
  video: 60,
  course: 600,
  practice: 120,
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

/** Roadmap steps shown before "View full journey". */
export const JOURNEY_LIMIT = 10;
