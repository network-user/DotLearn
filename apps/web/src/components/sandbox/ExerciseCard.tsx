import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { Surface } from '@/components/ui/Surface';

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
      <Surface
        variant="paper"
        className={cx(
          'transition-colors duration-med',
          status === 'pass' && 'border-l-2 border-l-ok',
          status === 'fail' && 'border-l-2 border-l-err',
        )}
      >
        <div className="p-5 space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="eyebrow font-mono">{type}</span>
                {status !== 'idle' && (
                  <Badge tone={statusTone} variant="outline">
                    {t(`exercise.status.${status === 'pass' ? 'pass' : 'fail'}` as const)}
                  </Badge>
                )}
              </div>
              <p className="text-[15.5px] text-fg whitespace-pre-wrap leading-[1.7]">{prompt}</p>
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
      </Surface>
    </div>
  );
};
