import { createContext, useContext, useId, type ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

interface SketchProps {
  viewBox: string;
  title: string;
  height?: number | undefined;
  maxWidth?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export const SKETCH_STROKE = 'rgb(var(--figure-stroke))';
export const SKETCH_MUTED = 'rgb(var(--fg-subtle))';
export const SKETCH_ACCENT = 'rgb(var(--accent-1))';
export const SKETCH_FONT = 'var(--font-stack-system)';
export const SKETCH_MONO = 'var(--font-stack-mono)';

export const sketchCategory = (index: number): string => `rgb(var(--viz-cat-${(index % 6) + 1}))`;

interface SketchRefs {
  arrowMarker: string;
  arrowMarkerAccent: string;
  hatchFill: string;
}

const SketchContext = createContext<SketchRefs>({
  arrowMarker: '',
  arrowMarkerAccent: '',
  hatchFill: '',
});

export const useSketchRefs = (): SketchRefs => useContext(SketchContext);

export const Sketch = ({ viewBox, title, height, maxWidth, className, children }: SketchProps) => {
  const rawId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const arrowId = `arrow-${rawId}`;
  const arrowAccentId = `arrowa-${rawId}`;
  const hatchId = `hatch-${rawId}`;
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      className={cx('block w-full mx-auto', className)}
      style={{ maxWidth: maxWidth ?? 560, height }}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 1 L 9 5 L 0 9"
            fill="none"
            stroke={SKETCH_STROKE}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <marker
          id={arrowAccentId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 1 L 9 5 L 0 9"
            fill="none"
            stroke={SKETCH_ACCENT}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <pattern
          id={hatchId}
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke={SKETCH_STROKE} strokeWidth="1" opacity="0.35" />
        </pattern>
      </defs>
      <SketchContext.Provider
        value={{
          arrowMarker: `url(#${arrowId})`,
          arrowMarkerAccent: `url(#${arrowAccentId})`,
          hatchFill: `url(#${hatchId})`,
        }}
      >
        {children}
      </SketchContext.Provider>
    </svg>
  );
};
