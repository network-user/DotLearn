import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { GlassSurface } from '@/components/ui/GlassSurface';

export type ExerciseCardStatus = 'idle' | 'pass' | 'fail';

interface ExerciseCardProps {
  type: string;
  prompt: string;
  difficultyLabel: string;
  status: ExerciseCardStatus;
  /** When this counter changes, pass/fail effects play */
  pulse?: number;
  rightHeader?: ReactNode;
  children: ReactNode;
}

export const ExerciseCard = ({
  type,
  prompt,
  difficultyLabel,
  status,
  pulse,
  rightHeader,
  children,
}: ExerciseCardProps) => {
  const { t } = useTranslation('runners');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [effect, setEffect] = useState<'pass' | 'fail' | null>(null);

  useEffect(() => {
    if (pulse === undefined) return;
    if (status === 'idle') return;
    setEffect(status as 'pass' | 'fail');
    const timer = window.setTimeout(() => setEffect(null), 800);
    return () => window.clearTimeout(timer);
  }, [pulse, status]);

  const statusTone =
    status === 'pass' ? 'success' : status === 'fail' ? 'danger' : 'neutral';

  return (
    <div
      ref={rootRef}
      className={cx(
        'relative',
        effect === 'pass' && 'dl-anim-pass-pop',
        effect === 'fail' && 'dl-anim-fail-shake',
      )}
    >
      <GlassSurface
        intensity="medium"
        bordered
        className={cx(
          'rounded-2xl transition-shadow duration-med',
          status === 'pass' && 'shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_0_28px_rgba(16,185,129,0.18)]',
          status === 'fail' && 'shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_24px_rgba(244,63,94,0.14)]',
        )}
      >
        <div className="p-5 space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-widest text-fg-subtle">
                <span className="font-mono">{type}</span>
                {status !== 'idle' && (
                  <Badge tone={statusTone} variant="soft">
                    {t(`exercise.status.${status === 'pass' ? 'pass' : 'fail'}` as const)}
                  </Badge>
                )}
              </div>
              <p className="text-[14.5px] text-fg whitespace-pre-wrap leading-relaxed">{prompt}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {rightHeader}
              <Badge tone="neutral" variant="outline">
                {difficultyLabel}
              </Badge>
            </div>
          </header>
          {children}
        </div>
      </GlassSurface>
    </div>
  );
};
