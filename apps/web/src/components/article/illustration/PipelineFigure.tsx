import { Fragment } from 'react';

import { Sketch } from './Sketch';
import { SketchArrow, SketchBox, SketchHighlight, SketchLabel } from './primitives';

interface PipelineStage {
  label: string;
  note?: string | undefined;
  active?: boolean | undefined;
}

interface PipelineFigureProps {
  stages: PipelineStage[];
  title?: string | undefined;
}

const STAGE_H = 34;
const GAP = 26;
const BOX_W = 170;
const BOX_X = 16;

export const PipelineFigure = ({ stages, title = 'Pipeline' }: PipelineFigureProps) => {
  const height = stages.length * STAGE_H + (stages.length - 1) * GAP + 16;
  return (
    <Sketch viewBox={`0 0 460 ${height}`} title={title} maxWidth={460}>
      {stages.map((stage, index) => {
        const y = 8 + index * (STAGE_H + GAP);
        return (
          <Fragment key={stage.label}>
            {stage.active && (
              <SketchHighlight x={BOX_X - 4} y={y - 4} width={BOX_W + 8} height={STAGE_H + 8} />
            )}
            <SketchBox
              x={BOX_X}
              y={y}
              width={BOX_W}
              height={STAGE_H}
              accent={stage.active}
              fill="rgb(var(--surface-2))"
            />
            <SketchLabel
              x={BOX_X + BOX_W / 2}
              y={y + STAGE_H / 2 + 4}
              mono
              accent={stage.active}
              size={12.5}
            >
              {stage.label}
            </SketchLabel>
            <SketchLabel
              x={BOX_X + BOX_W + 18}
              y={y + STAGE_H / 2 + 4}
              anchor="start"
              muted={!stage.active}
              accent={stage.active}
              size={11.5}
              weight={400}
            >
              {stage.note ?? ''}
            </SketchLabel>
            {index < stages.length - 1 && (
              <SketchArrow
                from={[BOX_X + BOX_W / 2, y + STAGE_H + 3]}
                to={[BOX_X + BOX_W / 2, y + STAGE_H + GAP - 3]}
              />
            )}
          </Fragment>
        );
      })}
    </Sketch>
  );
};
