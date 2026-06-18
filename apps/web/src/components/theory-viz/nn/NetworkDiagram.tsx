import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from '@/components/viz/VizShell';

import { NeuralVizConfigError } from './errors';

export interface NetworkDiagramProps {
  layers?: number[];
  label?: string;
  layerNames?: string[];
  stepIntervalMs?: number;
}

interface NeuronPosition {
  x: number;
  y: number;
}

const defaultLayers = [3, 4, 4, 2];
const width = 420;
const height = 240;
const horizontalPadding = 44;
const verticalPadding = 30;
const neuronRadius = 11;

export const NetworkDiagram = ({
  layers = defaultLayers,
  label = 'Многослойная сеть',
  layerNames,
  stepIntervalMs = 900,
}: NetworkDiagramProps) => {
  if (layers.length < 2) {
    throw new NeuralVizConfigError('NetworkDiagram: нужно минимум два слоя.');
  }
  if (layers.some((count) => count < 1 || !Number.isInteger(count))) {
    throw new NeuralVizConfigError(
      'NetworkDiagram: в каждом слое должно быть целое число нейронов >= 1.',
    );
  }

  const reduceMotion = useReducedMotion();
  const [activeLayer, setActiveLayer] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const svgTitleId = useId();
  const svgDescId = useId();

  const positions = useMemo<NeuronPosition[][]>(() => {
    const innerWidth = width - horizontalPadding * 2;
    return layers.map((count, layerIndex) => {
      const x =
        layers.length === 1
          ? width / 2
          : horizontalPadding + (layerIndex / (layers.length - 1)) * innerWidth;
      const innerHeight = height - verticalPadding * 2;
      return Array.from({ length: count }, (_, neuronIndex) => {
        const y =
          count === 1 ? height / 2 : verticalPadding + (neuronIndex / (count - 1)) * innerHeight;
        return { x, y };
      });
    });
  }, [layers]);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!playing) return;
    if (activeLayer >= layers.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(
      () => {
        setActiveLayer((previous) => Math.min(previous + 1, layers.length - 1));
      },
      reduceMotion ? 0 : stepIntervalMs,
    );
    return clearTimer;
  }, [playing, activeLayer, layers.length, stepIntervalMs, reduceMotion]);

  const play = (): void => {
    if (activeLayer >= layers.length - 1) setActiveLayer(0);
    setPlaying(true);
  };

  const pause = (): void => {
    clearTimer();
    setPlaying(false);
  };

  const step = (): void => {
    clearTimer();
    setPlaying(false);
    setActiveLayer((previous) => Math.min(previous + 1, layers.length - 1));
  };

  const reset = (): void => {
    clearTimer();
    setPlaying(false);
    setActiveLayer(0);
  };

  const atEnd = activeLayer >= layers.length - 1;

  const resolveLayerName = (index: number): string => {
    if (layerNames?.[index]) return layerNames[index];
    if (index === 0) return 'вход';
    if (index === layers.length - 1) return 'выход';
    return `скрытый ${index}`;
  };

  return (
    <VizShell
      label={label}
      description="Граф многослойной нейронной сети: слои нейронов соединены рёбрами; кнопки запускают прямой проход по слоям."
      liveCaption={`Прямой проход: активен слой ${resolveLayerName(activeLayer)} (${activeLayer + 1} из ${layers.length}).`}
      actions={
        <>
          {playing ? (
            <VizButton onClick={pause} tone="ghost">
              <Pause size={12} aria-hidden />
              Пауза
            </VizButton>
          ) : (
            <VizButton onClick={play}>
              <Play size={12} aria-hidden />
              {atEnd ? 'Заново' : 'Пуск'}
            </VizButton>
          )}
          <VizButton onClick={step} tone="ghost" disabled={atEnd}>
            Шаг
          </VizButton>
          <VizButton
            onClick={reset}
            tone="ghost"
            disabled={activeLayer === 0 && !playing}
            label="Сбросить прямой проход"
          >
            <RotateCcw size={12} aria-hidden />
          </VizButton>
        </>
      }
      footer={
        <span>
          Прямой проход: активен слой{' '}
          <span className="font-mono text-accent">{resolveLayerName(activeLayer)}</span> (
          {activeLayer + 1}/{layers.length})
        </span>
      }
    >
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[340px]"
          role="img"
          aria-labelledby={`${svgTitleId} ${svgDescId}`}
        >
          <title id={svgTitleId}>Граф многослойной нейронной сети с прямым проходом</title>
          <desc id={svgDescId}>
            {`Слои: ${layers.join(', ')} нейронов. Сейчас активен слой ${resolveLayerName(activeLayer)} (${activeLayer + 1} из ${layers.length}).`}
          </desc>
          {positions.slice(0, -1).map((layerPositions, layerIndex) =>
            layerPositions.flatMap((from, fromIndex) =>
              (positions[layerIndex + 1] ?? []).map((to, toIndex) => {
                const edgeLit = layerIndex < activeLayer;
                return (
                  <motion.line
                    key={`edge-${layerIndex}-${fromIndex}-${toIndex}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={edgeLit ? 'rgb(var(--accent-1))' : 'rgb(var(--border-base))'}
                    strokeWidth={edgeLit ? 1.3 : 0.7}
                    animate={{ opacity: edgeLit ? 0.55 : 0.28 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                );
              }),
            ),
          )}

          {positions.map((layerPositions, layerIndex) => {
            const layerLit = layerIndex <= activeLayer;
            const labelX = layerPositions[0]?.x;
            return (
              <g key={`layer-${layerIndex}`}>
                {labelX !== undefined && (
                  <text
                    x={labelX}
                    y={height - 8}
                    textAnchor="middle"
                    className={cx('font-mono', layerLit ? 'fill-accent' : 'fill-fg-subtle')}
                    fontSize={9}
                  >
                    {resolveLayerName(layerIndex)}
                  </text>
                )}
                {layerPositions.map((position, neuronIndex) => (
                  <motion.circle
                    key={`neuron-${layerIndex}-${neuronIndex}`}
                    cx={position.x}
                    cy={position.y}
                    r={neuronRadius}
                    stroke={layerLit ? 'rgb(var(--accent-1))' : 'rgb(var(--border-strong))'}
                    strokeWidth={1.3}
                    animate={{
                      fill: layerLit ? 'rgb(var(--accent-1))' : 'rgb(var(--surface-2))',
                      fillOpacity: layerLit ? 0.85 : 1,
                      scale: layerIndex === activeLayer && !reduceMotion ? [1, 1.18, 1] : 1,
                    }}
                    transition={
                      reduceMotion ? { duration: 0 } : { duration: 0.45, scale: { duration: 0.5 } }
                    }
                    style={{ transformOrigin: `${position.x}px ${position.y}px` }}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </VizShell>
  );
};
