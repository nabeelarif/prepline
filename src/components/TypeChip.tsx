import { TYPES } from '../domain/constants';
import type { ResourceType } from '../domain/types';

export function TypeChip({ type }: { type: ResourceType }) {
  return <span className={`chip t-${type}`}>{TYPES[type]}</span>;
}
