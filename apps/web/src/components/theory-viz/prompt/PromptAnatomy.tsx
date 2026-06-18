import { useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';

export type PromptSegmentRole =
  | 'system'
  | 'instruction'
  | 'context'
  | 'examples'
  | 'constraints'
  | 'format';

export interface PromptSegment {
  role: PromptSegmentRole;
  label: string;
  text: string;
}

export interface PromptAnatomyProps {
  label?: string;
  segments?: PromptSegment[];
  caption?: string;
}

interface RoleStyle {
  swatch: string;
  rule: string;
  tint: string;
  text: string;
}

const roleStyles: Record<PromptSegmentRole, RoleStyle> = {
  system: {
    swatch: 'bg-[rgb(var(--viz-cat-2))]',
    rule: 'border-l-[rgb(var(--viz-cat-2))]',
    tint: 'bg-[rgb(var(--viz-cat-2)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-2))]',
  },
  instruction: {
    swatch: 'bg-[rgb(var(--viz-cat-1))]',
    rule: 'border-l-[rgb(var(--viz-cat-1))]',
    tint: 'bg-[rgb(var(--viz-cat-1)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-1))]',
  },
  context: {
    swatch: 'bg-[rgb(var(--viz-cat-3))]',
    rule: 'border-l-[rgb(var(--viz-cat-3))]',
    tint: 'bg-[rgb(var(--viz-cat-3)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-3))]',
  },
  examples: {
    swatch: 'bg-[rgb(var(--viz-cat-5))]',
    rule: 'border-l-[rgb(var(--viz-cat-5))]',
    tint: 'bg-[rgb(var(--viz-cat-5)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-5))]',
  },
  constraints: {
    swatch: 'bg-[rgb(var(--viz-cat-4))]',
    rule: 'border-l-[rgb(var(--viz-cat-4))]',
    tint: 'bg-[rgb(var(--viz-cat-4)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-4))]',
  },
  format: {
    swatch: 'bg-[rgb(var(--viz-cat-6))]',
    rule: 'border-l-[rgb(var(--viz-cat-6))]',
    tint: 'bg-[rgb(var(--viz-cat-6)/0.06)]',
    text: 'text-[rgb(var(--viz-cat-6))]',
  },
};

const defaultLabel = 'Анатомия промпта';

const defaultCaption =
  'Хороший промпт собирается из ролей: каждая часть отвечает за свой слой смысла. Наведите или коснитесь сегмента, чтобы выделить его.';

const defaultSegments: PromptSegment[] = [
  {
    role: 'system',
    label: 'Роль / система',
    text: 'Ты опытный технический редактор, который пишет кратко и по делу.',
  },
  {
    role: 'instruction',
    label: 'Инструкция',
    text: 'Перепиши абзац ниже так, чтобы его понял новичок.',
  },
  {
    role: 'context',
    label: 'Контекст',
    text: 'Текст из документации про индексы базы данных, аудитория — джуниоры.',
  },
  {
    role: 'examples',
    label: 'Примеры',
    text: 'Было: «B-tree обеспечивает логарифмическую сложность». Стало: «Индекс ускоряет поиск».',
  },
  {
    role: 'constraints',
    label: 'Ограничения',
    text: 'Не длиннее трёх предложений. Без жаргона. Только на русском.',
  },
  {
    role: 'format',
    label: 'Формат ответа',
    text: 'Верни только готовый абзац без пояснений и заголовков.',
  },
];

export const PromptAnatomy = ({
  label = defaultLabel,
  segments = defaultSegments,
  caption = defaultCaption,
}: PromptAnatomyProps) => {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  return (
    <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden shadow-card">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2">
        <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{label}</span>
      </header>

      <div className="p-4 overflow-x-auto">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {segments.map((segment, index) => {
            const style = roleStyles[segment.role];
            const isActive = active === index;
            return (
              <button
                key={`legend-${index}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((value) => (value === index ? null : index))}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 min-h-[32px] text-[11.5px] font-medium transition-colors duration-fast',
                  isActive
                    ? cx('border-transparent', style.tint, style.text)
                    : 'border-border-base text-fg-muted hover:text-fg',
                )}
              >
                <span className={cx('size-2 rounded-full shrink-0', style.swatch)} />
                {segment.label}
              </button>
            );
          })}
        </div>

        <ol className="flex flex-col gap-2">
          {segments.map((segment, index) => {
            const style = roleStyles[segment.role];
            const isActive = active === index;
            const isDimmed = active !== null && !isActive;
            return (
              <motion.li
                key={`segment-${index}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.05 }}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((value) => (value === index ? null : index))}
                className={cx(
                  'rounded-md border-l-2 pl-3 pr-3 py-2.5 cursor-default transition-all duration-med',
                  style.rule,
                  isActive ? style.tint : 'bg-surface-2/40',
                  isDimmed ? 'opacity-45' : 'opacity-100',
                )}
              >
                <div className={cx('eyebrow mb-1 flex items-center gap-1.5', style.text)}>
                  <span className={cx('size-1.5 rounded-full shrink-0', style.swatch)} />
                  {segment.label}
                </div>
                <p className="font-mono text-[12.5px] leading-relaxed text-fg whitespace-pre-wrap break-words">
                  {segment.text}
                </p>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {caption && (
        <footer className="px-4 py-2.5 border-t border-border-base/60 bg-surface text-[12.5px] leading-relaxed text-fg-muted">
          {caption}
        </footer>
      )}
    </aside>
  );
};
