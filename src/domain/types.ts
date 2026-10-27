export type ResourceType = 'article' | 'video' | 'course' | 'practice';
export type ResourceStatus = 'not_started' | 'in_progress' | 'completed';
export type PhaseColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink' | 'gray';
/** Local calendar date as YYYY-MM-DD. Never converted through UTC. */
export type ISODate = string;

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: ResourceType;
  /** Estimated length. Durations are stored in minutes and shown as hours. */
  minutes: number;
  /** Partial progress; ignored once `done` is set, which credits the full estimate. */
  doneMinutes: number;
  notes: string;
  done: boolean;
  doneAt: ISODate | null;
  /** Set when the user starts the resource, so it can be In Progress at 0 minutes. */
  startedAt: ISODate | null;
  /** Optional grouping; null means the resource is in no phase. */
  phaseId: string | null;
  createdAt: ISODate;
}

/** An optional, named group of resources, shown as a milestone in the Phases view. */
export interface Phase {
  id: string;
  name: string;
  description: string;
  color: PhaseColor;
}

/** A plan. Called a goal in code for compatibility with saved data. */
export interface Goal {
  id: string;
  name: string;
  description: string;
  targetDate: ISODate;
  /** Daily study capacity; null when the user has not set one. */
  hoursPerDay: number | null;
  createdAt: ISODate;
  /** Order is priority order: the journey follows it from first to last. */
  resources: Resource[];
  /** Display order of phases. Resource order is still set by `resources`. */
  phases: Phase[];
}

export interface AppData {
  version: 1;
  activeGoalId: string | null;
  goals: Goal[];
}
