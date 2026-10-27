import type { Rating, ResourceType } from './types';

export const STORAGE_KEY = 'prepline:v1';

export const TYPES: Record<ResourceType, string> = {
  article: 'Article',
  video: 'Video',
  course: 'Course',
};
export const RESOURCE_TYPES = Object.keys(TYPES) as ResourceType[];

/** Default estimate in minutes when a resource is added without one. */
export const DEFAULT_MINUTES: Record<ResourceType, number> = {
  article: 15,
  video: 30,
  course: 300,
};

export const RATE_LABELS: Record<Rating, string> = {
  1: 'Lost',
  2: 'Shaky',
  3: 'Okay',
  4: 'Solid',
  5: 'Could teach it',
};
export const RATINGS: Rating[] = [1, 2, 3, 4, 5];

/** Timeline days shown before "Show more". */
export const DAY_LIMIT = 10;
