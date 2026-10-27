export type ResourceType = 'article' | 'video' | 'course';
export type Rating = 1 | 2 | 3 | 4 | 5;
/** Local calendar date as YYYY-MM-DD. Never converted through UTC. */
export type ISODate = string;

export interface Section {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
  doneAt: ISODate | null;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: ResourceType;
  /** Ignored when the resource has sections; the sections' minutes are used instead. */
  minutes: number;
  notes: string;
  /** Ignored when the resource has sections; it is done when every section is. */
  done: boolean;
  doneAt: ISODate | null;
  rating: Rating | null;
  sections: Section[];
}

export interface Goal {
  id: string;
  name: string;
  targetDate: ISODate;
  hoursPerDay: number;
  sample: boolean;
  createdAt: ISODate;
  /** Order is priority order: the schedule works through them top to bottom. */
  resources: Resource[];
}

export interface AppData {
  version: 1;
  activeGoalId: string | null;
  goals: Goal[];
}

/** One schedulable piece of work: a resource without sections, or one section of a resource. */
export interface WorkUnit {
  resId: string;
  secId: string | null;
  title: string;
  /** Parent resource title, set when the unit is a section. */
  parent?: string;
  type: ResourceType;
  url: string;
  minutes: number;
}
