import { useEffect, useRef } from 'react';

/** Moves focus to a step's heading when the step changes, so screen readers follow along. */
export function useStepFocus(step: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [step]);
  return ref;
}
