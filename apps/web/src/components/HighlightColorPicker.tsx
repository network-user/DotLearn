import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { HIGHLIGHT_COLORS } from '@/lib/highlight-colors';
import type { HighlightColor } from '@/lib/progress-db';

interface HighlightColorPickerProps {
  value?: HighlightColor | undefined;
  onSelect: (color: HighlightColor) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const HighlightColorPicker = ({
  value,
  onSelect,
  size = 'md',
  className,
}: HighlightColorPickerProps) => {
  const { t } = useTranslation('topic');
  return (
    <div
      role="group"
      aria-label={t('highlight.pickerLabel')}
      className={cx('flex items-center gap-1.5', className)}
    >
      {HIGHLIGHT_COLORS.map((color) => {
        const label = t(`highlight.colors.${color.id}`);
        const selected = value === color.id;
        return (
          <button
            key={color.id}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={value === undefined ? undefined : selected}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(color.id)}
            className={cx(
              'rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/15',
              size === 'md' ? 'size-8' : 'size-6',
              color.swatchClass,
              selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
            )}
          />
        );
      })}
    </div>
  );
};
