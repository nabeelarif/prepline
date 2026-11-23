import { TYPES } from '../domain/constants';
import type { ResourceType } from '../domain/types';

/** A resource's type as a colored text label. */
export function TypeLabel({ type }: { type: ResourceType }) {
  return <span className={`res-type t-${type}`}>{TYPES[type]}</span>;
}
