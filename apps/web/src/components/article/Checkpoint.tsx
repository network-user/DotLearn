import { useState } from 'react';
import type { ReactNode } from 'react';

import { Brain, Check, Eye, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface CheckpointProps {
  q: string;
  choices?: string[];
  answer?: number;
  explain?: string;
  children?: ReactNode;
}

type SelfRating = 'gotIt' | 'missed' | null;

const ghostButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg';

const ChoiceMode = ({
  choices,
  answer,
  explain,
}: {
  choices: string[];
  answer: number;
  explain?: string | undefined;
}) => {
  const { t } = useTranslation('viz');
  const [selected, setSelected] = useState<number | null>(null);

  const answered = selected !== null;
  const isCorrect = answered && selected === answer;

  return (
    <div className="mt-4">
      <ul className="flex flex-col gap-2">
        {choices.map((choice, index) => {
          const isChosen = selected === index;
          const isAnswer = index === answer;
          const showOk = answered && isAnswer;
          const showErr = answered && isChosen && !isAnswer;

          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  if (!answered) setSelected(index);
                }}
                disabled={answered}
                aria-pressed={isChosen}
                className={cx(
                  'flex w-full min-h-[var(--tap)] items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[14.5px] transition-colors sm:min-h-0',
                  !answered && 'border-border-base bg-surface text-fg hover:bg-surface-2',
                  answered && !showOk && !showErr && 'border-border-base bg-surface text-fg-subtle',
                  showOk && 'border-ok/50 bg-ok/10 text-ok',
                  showErr && 'border-err/50 bg-err/10 text-err',
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {showOk && <Check className="h-4 w-4" />}
                  {showErr && <X className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">{choice}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="mt-3">
          <p className={cx('text-[14px] font-medium', isCorrect ? 'text-ok' : 'text-err')}>
            {isCorrect ? t('checkpoint.correct') : t('checkpoint.incorrect')}
          </p>
          {explain && <p className="mt-1.5 text-[14px] text-fg-muted">{explain}</p>}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cx(ghostButtonClass, 'mt-2')}
          >
            {t('checkpoint.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
};

const RecallMode = ({ children }: { children?: ReactNode }) => {
  const { t } = useTranslation('viz');
  const [revealed, setRevealed] = useState(false);
  const [selfRated, setSelfRated] = useState<SelfRating>(null);

  if (!revealed) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-[14px] font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Eye className="h-4 w-4 text-accent" aria-hidden />
          {t('checkpoint.reveal')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="text-[15px] text-fg leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
        {children}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {selfRated === null ? (
          <>
            <button
              type="button"
              onClick={() => setSelfRated('gotIt')}
              className={ghostButtonClass}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t('checkpoint.gotIt')}
            </button>
            <button
              type="button"
              onClick={() => setSelfRated('missed')}
              className={ghostButtonClass}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('checkpoint.missed')}
            </button>
          </>
        ) : (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium',
              selfRated === 'gotIt' ? 'bg-ok/10 text-ok' : 'bg-accent/10 text-accent',
            )}
          >
            {selfRated === 'gotIt' ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden />
            )}
            {selfRated === 'gotIt' ? t('checkpoint.gotIt') : t('checkpoint.missed')}
          </span>
        )}
      </div>
    </div>
  );
};

export const Checkpoint = (props: CheckpointProps) => {
  const { q, choices, answer, explain, children } = props;
  const { t } = useTranslation('viz');

  return (
    <aside className="not-prose my-7 rounded-xl border border-border-base bg-surface-2/40 p-4 sm:p-5">
      <div className="eyebrow flex items-center gap-1.5 text-accent">
        <Brain className="h-3.5 w-3.5" aria-hidden />
        {t('checkpoint.prompt')}
      </div>
      <p className="mt-2 font-serif text-[16.5px] text-fg">{q}</p>

      {Array.isArray(choices) && choices.length > 0 && typeof answer === 'number' ? (
        <ChoiceMode choices={choices} answer={answer} explain={explain} />
      ) : (
        <RecallMode>{children}</RecallMode>
      )}
    </aside>
  );
};
