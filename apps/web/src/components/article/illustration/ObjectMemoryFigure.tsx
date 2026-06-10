import { Fragment } from 'react';

import { Sketch, SKETCH_STROKE } from './Sketch';
import { SketchArrow, SketchBox, SketchLabel } from './primitives';

interface MemoryObject {
  name: string;
  className: string;
  attrs: Record<string, string>;
}

interface ObjectMemoryFigureProps {
  objects: MemoryObject[];
  sharedName?: string | undefined;
  title?: string | undefined;
}

const NAME_W = 96;
const OBJ_W = 200;
const ATTR_H = 22;
const OBJ_HEADER_H = 26;
const OBJ_GAP = 26;

export const ObjectMemoryFigure = ({
  objects,
  sharedName,
  title = 'Names and objects',
}: ObjectMemoryFigureProps) => {
  const objX = NAME_W + 110;
  const heights = objects.map(
    (object) => OBJ_HEADER_H + Object.keys(object.attrs).length * ATTR_H + 8,
  );
  const tops: number[] = [];
  let cursor = 12;
  for (const objectHeight of heights) {
    tops.push(cursor);
    cursor += objectHeight + OBJ_GAP;
  }
  const height = cursor - OBJ_GAP + 16;
  const width = objX + OBJ_W + 16;

  return (
    <Sketch viewBox={`0 0 ${width} ${height}`} title={title} maxWidth={Math.min(560, width)}>
      {objects.map((object, index) => {
        const top = tops[index] ?? 12;
        const objHeight = heights[index] ?? OBJ_HEADER_H;
        const nameY = top + objHeight / 2;
        const isShared = sharedName !== undefined && object.name === sharedName;
        return (
          <Fragment key={`${object.name}-${index}`}>
            <SketchBox
              x={12}
              y={nameY - 14}
              width={NAME_W}
              height={28}
              radius={14}
              fill="rgb(var(--surface-2))"
              accent={isShared}
            />
            <SketchLabel x={12 + NAME_W / 2} y={nameY + 4} mono size={12} accent={isShared}>
              {object.name}
            </SketchLabel>
            <SketchArrow
              from={[12 + NAME_W + 6, nameY]}
              to={[objX - 8, top + OBJ_HEADER_H / 2 + 6]}
              accent={isShared}
              curve={index % 2 === 0 ? -6 : 6}
            />
            <SketchBox x={objX} y={top} width={OBJ_W} height={objHeight} />
            <SketchLabel x={objX + OBJ_W / 2} y={top + 17} size={11} muted>
              {object.className}
            </SketchLabel>
            <line
              x1={objX}
              y1={top + OBJ_HEADER_H}
              x2={objX + OBJ_W}
              y2={top + OBJ_HEADER_H}
              stroke={SKETCH_STROKE}
              strokeWidth={1}
              opacity={0.6}
            />
            {Object.entries(object.attrs).map(([key, value], attrIndex) => (
              <Fragment key={key}>
                <SketchLabel
                  x={objX + 12}
                  y={top + OBJ_HEADER_H + attrIndex * ATTR_H + 16}
                  anchor="start"
                  mono
                  size={11.5}
                  weight={400}
                >
                  {key}
                </SketchLabel>
                <SketchLabel
                  x={objX + OBJ_W - 12}
                  y={top + OBJ_HEADER_H + attrIndex * ATTR_H + 16}
                  anchor="end"
                  mono
                  size={11.5}
                  muted
                >
                  {value}
                </SketchLabel>
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </Sketch>
  );
};
