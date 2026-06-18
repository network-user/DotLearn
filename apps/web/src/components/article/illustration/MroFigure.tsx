import { Fragment } from 'react';

import { Sketch } from './Sketch';
import { SketchArrow, SketchBox, SketchHighlight, SketchLabel } from './primitives';

interface MroFigureProps {
  chain: string[];
  lookup?: string | undefined;
  foundIn?: string | undefined;
  startLabel?: string | undefined;
  title?: string | undefined;
}

const BOX_W = 150;
const BOX_H = 40;
const GAP = 44;

export const MroFigure = ({
  chain,
  lookup,
  foundIn,
  startLabel,
  title = 'Method resolution order',
}: MroFigureProps) => {
  const width = 12 + chain.length * (BOX_W + GAP) - GAP + 12;
  const y = 52;
  return (
    <Sketch viewBox={`0 0 ${width} 140`} title={title} maxWidth={Math.min(640, width)}>
      {lookup && (
        <SketchLabel x={12 + BOX_W / 2} y={24} mono accent size={12}>
          {lookup}
        </SketchLabel>
      )}
      {startLabel && (
        <SketchLabel x={12 + BOX_W / 2} y={y + BOX_H + 28} muted size={11}>
          {startLabel}
        </SketchLabel>
      )}
      {chain.map((cls, index) => {
        const x = 12 + index * (BOX_W + GAP);
        const found = foundIn !== undefined && cls === foundIn;
        const searched =
          foundIn === undefined || chain.indexOf(foundIn) === -1
            ? true
            : index <= chain.indexOf(foundIn);
        return (
          <Fragment key={cls}>
            {found && <SketchHighlight x={x - 4} y={y - 4} width={BOX_W + 8} height={BOX_H + 8} />}
            <SketchBox
              x={x}
              y={y}
              width={BOX_W}
              height={BOX_H}
              fill="rgb(var(--surface-2))"
              accent={found}
              dashed={!searched}
            />
            <SketchLabel
              x={x + BOX_W / 2}
              y={y + BOX_H / 2 + 4}
              mono
              size={12.5}
              accent={found}
              muted={!searched}
            >
              {cls}
            </SketchLabel>
            <SketchLabel x={x + BOX_W / 2} y={y - 12} muted size={10.5}>
              {`${index + 1}`}
            </SketchLabel>
            {index < chain.length - 1 && (
              <SketchArrow
                from={[x + BOX_W + 4, y + BOX_H / 2]}
                to={[x + BOX_W + GAP - 4, y + BOX_H / 2]}
                accent={searched && (foundIn === undefined || index < chain.indexOf(foundIn))}
                dashed={!searched}
              />
            )}
          </Fragment>
        );
      })}
    </Sketch>
  );
};
