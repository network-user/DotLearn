import { Fragment } from 'react';

import { Sketch, SKETCH_STROKE } from './Sketch';
import { SketchArrow, SketchBox, SketchLabel } from './primitives';

interface FilterRow {
  cells: string[];
  kept: boolean;
}

interface RowFilterFigureProps {
  columns: string[];
  rows: FilterRow[];
  condition?: string | undefined;
  title?: string | undefined;
}

const ROW_H = 26;
const HEADER_H = 28;

export const RowFilterFigure = ({
  columns,
  rows,
  condition,
  title = 'Row filter',
}: RowFilterFigureProps) => {
  const colW = Math.max(64, Math.min(96, 320 / columns.length));
  const tableW = colW * columns.length;
  const leftX = 12;
  const rightX = leftX + tableW + 110;
  const keptRows = rows.filter((row) => row.kept);
  const leftH = HEADER_H + rows.length * ROW_H;
  const rightH = HEADER_H + keptRows.length * ROW_H;
  const height = Math.max(leftH, rightH) + 46;
  const width = rightX + tableW + 12;

  const renderTable = (
    x: number,
    tableRows: FilterRow[],
    showDropped: boolean,
  ): React.ReactNode => (
    <>
      <SketchBox x={x} y={30} width={tableW} height={HEADER_H + tableRows.length * ROW_H} radius={6} />
      {columns.map((column, columnIndex) => (
        <SketchLabel
          key={column}
          x={x + columnIndex * colW + colW / 2}
          y={30 + HEADER_H / 2 + 4}
          mono
          size={11}
          muted
        >
          {column}
        </SketchLabel>
      ))}
      <line
        x1={x}
        y1={30 + HEADER_H}
        x2={x + tableW}
        y2={30 + HEADER_H}
        stroke={SKETCH_STROKE}
        strokeWidth={1.5}
      />
      {tableRows.map((row, rowIndex) => {
        const y = 30 + HEADER_H + rowIndex * ROW_H;
        const dropped = showDropped && !row.kept;
        return (
          <Fragment key={rowIndex}>
            {rowIndex > 0 && (
              <line
                x1={x}
                y1={y}
                x2={x + tableW}
                y2={y}
                stroke={SKETCH_STROKE}
                strokeWidth={0.75}
                opacity={0.4}
              />
            )}
            {row.cells.map((cell, cellIndex) => (
              <SketchLabel
                key={cellIndex}
                x={x + cellIndex * colW + colW / 2}
                y={y + ROW_H / 2 + 4}
                mono
                size={11.5}
                muted={dropped}
                weight={400}
              >
                {cell}
              </SketchLabel>
            ))}
            {dropped && (
              <line
                x1={x + 6}
                y1={y + ROW_H / 2}
                x2={x + tableW - 6}
                y2={y + ROW_H / 2}
                stroke="rgb(var(--err))"
                strokeWidth={1.25}
                opacity={0.7}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );

  return (
    <Sketch viewBox={`0 0 ${width} ${height}`} title={title} maxWidth={Math.min(640, width)}>
      <SketchLabel x={leftX + tableW / 2} y={18} size={11} muted>
        {`${rows.length}`}
      </SketchLabel>
      {renderTable(leftX, rows, true)}
      <SketchArrow
        from={[leftX + tableW + 14, 30 + leftH / 2]}
        to={[rightX - 14, 30 + leftH / 2]}
        accent
      />
      {condition && (
        <SketchLabel
          x={(leftX + tableW + rightX) / 2}
          y={30 + leftH / 2 - 12}
          mono
          accent
          size={11}
        >
          {condition}
        </SketchLabel>
      )}
      <SketchLabel x={rightX + tableW / 2} y={18} size={11} muted>
        {`${keptRows.length}`}
      </SketchLabel>
      {renderTable(rightX, keptRows, false)}
    </Sketch>
  );
};
