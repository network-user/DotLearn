import type { ReactNode } from 'react';

import { SKETCH_ACCENT, SKETCH_FONT, SKETCH_MONO, SKETCH_STROKE, useSketchRefs } from './Sketch';

interface SketchBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string | undefined;
  hatched?: boolean | undefined;
  accent?: boolean | undefined;
  dashed?: boolean | undefined;
  radius?: number | undefined;
}

export const SketchBox = ({
  x,
  y,
  width,
  height,
  fill = 'none',
  hatched = false,
  accent = false,
  dashed = false,
  radius = 6,
}: SketchBoxProps) => {
  const { hatchFill } = useSketchRefs();
  return (
    <>
      {hatched && <rect x={x} y={y} width={width} height={height} rx={radius} fill={hatchFill} />}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        fill={hatched ? 'none' : fill}
        stroke={accent ? SKETCH_ACCENT : SKETCH_STROKE}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeLinejoin="round"
      />
    </>
  );
};

interface SketchLabelProps {
  x: number;
  y: number;
  children: ReactNode;
  size?: number | undefined;
  mono?: boolean | undefined;
  muted?: boolean | undefined;
  accent?: boolean | undefined;
  anchor?: 'start' | 'middle' | 'end' | undefined;
  weight?: number | undefined;
}

export const SketchLabel = ({
  x,
  y,
  children,
  size = 12,
  mono = false,
  muted = false,
  accent = false,
  anchor = 'middle',
  weight = 500,
}: SketchLabelProps) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontFamily={mono ? SKETCH_MONO : SKETCH_FONT}
    fontSize={size}
    fontWeight={weight}
    fill={accent ? SKETCH_ACCENT : muted ? 'rgb(var(--fg-subtle))' : 'rgb(var(--fg))'}
  >
    {children}
  </text>
);

interface SketchArrowProps {
  from: [number, number];
  to: [number, number];
  curve?: number | undefined;
  dashed?: boolean | undefined;
  accent?: boolean | undefined;
}

export const SketchArrow = ({
  from,
  to,
  curve = 0,
  dashed = false,
  accent = false,
}: SketchArrowProps) => {
  const { arrowMarker, arrowMarkerAccent } = useSketchRefs();
  const [x1, y1] = from;
  const [x2, y2] = to;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const cx = midX + (-dy / length) * curve;
  const cy = midY + (dx / length) * curve;
  const d = curve === 0 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={accent ? SKETCH_ACCENT : SKETCH_STROKE}
      strokeWidth={1.5}
      strokeDasharray={dashed ? '5 4' : undefined}
      markerEnd={accent ? arrowMarkerAccent : arrowMarker}
      strokeLinecap="round"
    />
  );
};

interface SketchHighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number | undefined;
}

export const SketchHighlight = ({ x, y, width, height, radius = 6 }: SketchHighlightProps) => (
  <rect x={x} y={y} width={width} height={height} rx={radius} fill={SKETCH_ACCENT} opacity={0.12} />
);
