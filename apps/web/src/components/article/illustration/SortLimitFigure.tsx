import { Fragment } from 'react';

import { Sketch, SKETCH_ACCENT } from './Sketch';
import { SketchArrow, SketchLabel } from './primitives';

interface SortItem {
  label: string;
  value: number;
}

interface SortLimitFigureProps {
  items: SortItem[];
  limit?: number | undefined;
  desc?: boolean | undefined;
  orderLabel?: string | undefined;
  title?: string | undefined;
  unsortedLabel?: string | undefined;
  sortedLabel?: string | undefined;
}

const ROW_H = 30;
const PANEL_W = 200;

export const SortLimitFigure = ({
  items,
  limit,
  desc = true,
  orderLabel,
  title = 'ORDER BY / LIMIT',
  unsortedLabel = 'unsorted',
  sortedLabel = 'sorted',
}: SortLimitFigureProps) => {
  const sorted = [...items].sort((a, b) => (desc ? b.value - a.value : a.value - b.value));
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const leftX = 12;
  const rightX = leftX + PANEL_W + 96;
  const height = items.length * ROW_H + 56;
  const width = rightX + PANEL_W + 12;

  const renderPanel = (x: number, panelItems: SortItem[], withLimit: boolean): React.ReactNode =>
    panelItems.map((item, index) => {
      const y = 36 + index * ROW_H;
      const barW = 12 + (item.value / maxValue) * (PANEL_W - 76);
      const cut = withLimit && limit !== undefined && index >= limit;
      return (
        <Fragment key={item.label}>
          <SketchLabel
            x={x}
            y={y + ROW_H / 2 + 4}
            anchor="start"
            mono
            size={11.5}
            muted={cut}
            weight={400}
          >
            {item.label}
          </SketchLabel>
          <rect
            x={x + 58}
            y={y + 7}
            width={barW}
            height={ROW_H - 14}
            rx={3}
            fill={cut ? 'rgb(var(--fg-subtle))' : SKETCH_ACCENT}
            opacity={cut ? 0.25 : 0.85}
          />
          <SketchLabel
            x={x + 58 + barW + 8}
            y={y + ROW_H / 2 + 4}
            anchor="start"
            mono
            size={11}
            muted
          >
            {item.value}
          </SketchLabel>
        </Fragment>
      );
    });

  const limitY = limit !== undefined ? 36 + limit * ROW_H - 2 : null;

  return (
    <Sketch viewBox={`0 0 ${width} ${height}`} title={title} maxWidth={Math.min(640, width)}>
      <SketchLabel x={leftX} y={20} anchor="start" size={11} muted>
        {unsortedLabel}
      </SketchLabel>
      {renderPanel(leftX, items, false)}
      <SketchArrow
        from={[leftX + PANEL_W + 12, height / 2]}
        to={[rightX - 16, height / 2]}
        accent
      />
      {orderLabel && (
        <SketchLabel x={(leftX + PANEL_W + rightX) / 2} y={height / 2 - 12} mono accent size={10.5}>
          {orderLabel}
        </SketchLabel>
      )}
      <SketchLabel x={rightX} y={20} anchor="start" size={11} muted>
        {sortedLabel}
      </SketchLabel>
      {renderPanel(rightX, sorted, true)}
      {limitY !== null && (
        <>
          <line
            x1={rightX - 6}
            y1={limitY}
            x2={rightX + PANEL_W}
            y2={limitY}
            stroke="rgb(var(--err))"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <SketchLabel x={rightX + PANEL_W} y={limitY - 6} anchor="end" mono size={10.5} muted>
            {`LIMIT ${limit}`}
          </SketchLabel>
        </>
      )}
    </Sketch>
  );
};
