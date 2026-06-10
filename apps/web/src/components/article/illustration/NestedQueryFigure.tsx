import { Sketch } from './Sketch';
import { SketchArrow, SketchBox, SketchHighlight, SketchLabel } from './primitives';

interface NestedQueryFigureProps {
  outerLabel: string;
  innerLabel: string;
  innerResult: string;
  resultLabel: string;
  stepLabels?: [string, string] | undefined;
  footnote?: string | undefined;
  title?: string | undefined;
}

export const NestedQueryFigure = ({
  outerLabel,
  innerLabel,
  innerResult,
  resultLabel,
  stepLabels = ['1', '2'],
  footnote,
  title = 'Subquery evaluation',
}: NestedQueryFigureProps) => (
  <Sketch viewBox="0 0 520 240" title={title} maxWidth={520}>
    <SketchBox x={16} y={16} width={300} height={170} fill="rgb(var(--surface-2))" />
    <SketchLabel x={28} y={42} anchor="start" mono size={12.5}>
      {outerLabel}
    </SketchLabel>
    <SketchHighlight x={40} y={64} width={252} height={64} />
    <SketchBox x={40} y={64} width={252} height={64} accent dashed />
    <SketchLabel x={166} y={92} mono accent size={12}>
      {innerLabel}
    </SketchLabel>
    <SketchLabel x={166} y={112} mono muted size={10.5}>
      {`→ ${innerResult}`}
    </SketchLabel>
    <circle cx={40} cy={64} r={10} fill="rgb(var(--accent-1))" />
    <SketchLabel x={40} y={68} size={11} weight={700} anchor="middle">
      <tspan fill="rgb(var(--surface))">{stepLabels[0]}</tspan>
    </SketchLabel>
    <SketchArrow from={[316, 100]} to={[420, 100]} accent />
    <circle cx={368} cy={84} r={10} fill="rgb(var(--accent-1))" />
    <SketchLabel x={368} y={88} size={11} weight={700} anchor="middle">
      <tspan fill="rgb(var(--surface))">{stepLabels[1]}</tspan>
    </SketchLabel>
    <SketchBox x={420} y={72} width={86} height={56} fill="rgb(var(--surface-2))" />
    <SketchLabel x={463} y={104} mono size={11.5}>
      {resultLabel}
    </SketchLabel>
    {footnote && (
      <SketchLabel x={166} y={214} muted size={11}>
        {footnote}
      </SketchLabel>
    )}
  </Sketch>
);
