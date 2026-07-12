import { useState, type ReactNode } from 'react';
import { BookOpenCheck, Command, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cx } from '@/components/ui/cx';

const STORAGE_KEY = 'dotlearn:onboarding-seen';
const STEP_COUNT = 3;

const readSeen = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSeen = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
};

const stepIcons: ReactNode[] = [
  <Compass key="compass" size={26} className="text-accent" />,
  <BookOpenCheck key="book" size={26} className="text-accent" />,
  <Command key="command" size={26} className="text-accent" />,
];

export const Onboarding = ({ onDismiss }: { onDismiss?: () => void } = {}) => {
  const { t } = useTranslation('help');
  const [open, setOpen] = useState(() => !readSeen());
  const [step, setStep] = useState(0);

  if (readSeen()) return null;

  const close = () => {
    writeSeen();
    setOpen(false);
    onDismiss?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      close();
    }
  };

  const isLast = step === STEP_COUNT - 1;
  const stepIndex = step + 1;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      placement="sheet"
      size="md"
      title={t(`onboarding.step${stepIndex}Title`)}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={close}
            className="min-h-[var(--tap)] sm:min-h-0"
          >
            {t('onboarding.skip')}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="min-h-[var(--tap)] sm:min-h-0"
              >
                {t('onboarding.back')}
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (isLast) {
                  close();
                } else {
                  setStep((value) => Math.min(STEP_COUNT - 1, value + 1));
                }
              }}
              className="min-h-[var(--tap)] sm:min-h-0"
            >
              {isLast ? t('onboarding.done') : t('onboarding.next')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid size-12 place-items-center rounded-2xl bg-accent/10">
          {stepIcons[step]}
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">
          {t(`onboarding.step${stepIndex}Body`)}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span
              key={index}
              className={cx(
                'h-1.5 rounded-full transition-all duration-fast',
                index === step ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong',
              )}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
};
