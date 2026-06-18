import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface ComposedPart {
  name: string;
  variants: string[];
}

interface CompositionVizProps {
  inheritChain?: string[];
  hostName?: string;
  parts?: ComposedPart[];
  label?: string;
}

const defaultChain = ['Vehicle', 'Car', 'SportsCar'];

const defaultParts: ComposedPart[] = [
  { name: 'engine', variants: ['PetrolEngine', 'ElectricEngine'] },
  { name: 'wheels', variants: ['AllSeasonWheels'] },
  { name: 'gps', variants: ['BasicGps'] },
];

const RIPPLE_MS = 420;

export const CompositionViz = ({
  inheritChain = defaultChain,
  hostName = 'Car',
  parts = defaultParts,
  label,
}: CompositionVizProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [rippleStep, setRippleStep] = useState<number | null>(null);
  const [rippled, setRippled] = useState(false);
  const [variantIndex, setVariantIndex] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const ripple = (): void => {
    setRippled(false);
    if (reduceMotion) {
      setRippled(true);
      return;
    }
    const advance = (step: number): void => {
      if (step >= inheritChain.length) {
        setRippleStep(null);
        setRippled(true);
        return;
      }
      setRippleStep(step);
      timerRef.current = window.setTimeout(() => advance(step + 1), RIPPLE_MS);
    };
    advance(0);
  };

  const primaryVariants = parts[0]?.variants ?? [];

  const swap = (): void => {
    if (primaryVariants.length < 2) return;
    setVariantIndex((index) => (index + 1) % primaryVariants.length);
    setSwapped(true);
  };

  const footer = rippled ? (
    <span className="text-warn">{t('compose.rippled')}</span>
  ) : swapped ? (
    <span className="text-ok">{t('compose.swapped')}</span>
  ) : null;

  return (
    <VizShell label={label ?? `${t('compose.isA')} / ${t('compose.hasA')}`} footer={footer}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-base bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
              {t('compose.isA')}
            </span>
            <VizButton onClick={ripple} tone="ghost">
              <Zap size={11} />
              {t('compose.changeBase')}
            </VizButton>
          </div>
          <div className="flex flex-col items-center gap-1">
            {inheritChain.map((name, index) => (
              <div key={name} className="flex flex-col items-center gap-1 w-full">
                {index > 0 && <span className="text-fg-subtle text-[11px] leading-none">↑</span>}
                <motion.div
                  animate={rippleStep === index && !reduceMotion ? { scale: [1, 1.04, 1] } : {}}
                  transition={{ duration: RIPPLE_MS / 1000 }}
                  className={cx(
                    'w-full max-w-[200px] rounded-lg border px-3 py-2 text-center font-mono text-[12.5px] transition-colors',
                    rippleStep === index || (rippled && rippleStep === null)
                      ? 'border-warn/60 bg-warn/10 text-warn'
                      : 'border-border-base bg-surface text-fg',
                  )}
                >
                  {name}
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-base bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
              {t('compose.hasA')}
            </span>
            <VizButton onClick={swap} tone="ghost" disabled={primaryVariants.length < 2}>
              <RefreshCw size={11} />
              {t('compose.swapPart')}
            </VizButton>
          </div>
          <div className="rounded-lg border border-border-base bg-surface px-3 py-2.5">
            <div className="font-mono text-[12.5px] font-semibold text-fg mb-2">{hostName}</div>
            <ul className="space-y-1.5">
              {parts.map((part, partIndex) => {
                const variant =
                  (partIndex === 0 ? part.variants[variantIndex] : part.variants[0]) ?? '?';
                return (
                  <li key={part.name} className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="text-accent">self.{part.name}</span>
                    <span className="text-fg-subtle">=</span>
                    <span className="relative inline-flex overflow-hidden">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={variant}
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className={cx(
                            'rounded px-1.5 py-0.5',
                            partIndex === 0 && swapped
                              ? 'bg-ok/15 text-ok'
                              : 'bg-surface-2 text-fg',
                          )}
                        >
                          {variant}()
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </VizShell>
  );
};
