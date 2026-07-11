import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
}

export const AnimatedNumber = ({ value, durationMs = 900 }: AnimatedNumberProps) => {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const frameRef = useRef<number | null>(null);
  const displayedRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    const from = mountedRef.current ? displayedRef.current : 0;
    mountedRef.current = true;

    if (reduceMotion) {
      displayedRef.current = value;
      setDisplayed(value);
      return;
    }

    if (from === value) {
      return;
    }

    const start = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs, reduceMotion]);

  return <>{displayed}</>;
};
