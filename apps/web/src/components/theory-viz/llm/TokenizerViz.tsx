import { useMemo } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizShell } from '@/components/viz/VizShell';

export interface TokenizerVizProps {
  text?: string;
  tokens?: string[];
  label?: string;
  countLabel?: string;
  charLabel?: string;
}

interface TokenChip {
  text: string;
  id: number;
}

const defaultText = 'Большие языковые модели читают токены, а не буквы.';

const vocabSeed = [
  'Боль',
  'шие',
  ' язы',
  'ковые',
  ' моде',
  'ли',
  ' чита',
  'ют',
  ' ток',
  'ены',
  ', а',
  ' не',
  ' бук',
  'вы',
  '.',
];

const tokenId = (piece: string): number => {
  let hash = 2166136261;
  for (const char of piece) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 50000;
};

const bpeSplit = (text: string): string[] => {
  const pieces: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let matched = '';
    for (const candidate of vocabSeed) {
      if (
        candidate.length > matched.length &&
        text.slice(cursor, cursor + candidate.length) === candidate
      ) {
        matched = candidate;
      }
    }
    if (matched.length === 0) {
      const remainder = text.slice(cursor);
      const wordMatch = remainder.match(/^(\s*[\p{L}\p{N}]+|\s+|.)/u);
      matched = wordMatch ? wordMatch[0] : (remainder[0] ?? '');
    }
    pieces.push(matched);
    cursor += matched.length;
  }
  return pieces.filter((piece) => piece.length > 0);
};

const renderPiece = (piece: string): string => piece.replace(/ /g, '·');

export const TokenizerViz = ({
  text = defaultText,
  tokens,
  label = 'Токенизация',
  countLabel = 'токенов',
  charLabel = 'символов',
}: TokenizerVizProps) => {
  const reduceMotion = useReducedMotion();

  const chips = useMemo<TokenChip[]>(() => {
    const pieces = tokens && tokens.length > 0 ? tokens : bpeSplit(text);
    return pieces.map((piece) => ({ text: piece, id: tokenId(piece) }));
  }, [text, tokens]);

  const charCount = text.length;

  return (
    <VizShell
      label={label}
      footer={
        <span>
          <span className="font-mono text-accent tabular-nums">{chips.length}</span> {countLabel}{' '}
          <span className="text-border-strong">·</span>{' '}
          <span className="font-mono tabular-nums">{charCount}</span> {charLabel}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border-base bg-surface-2 px-3 py-2.5 font-serif text-[15px] leading-relaxed text-fg-muted">
          {text}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip, index) => (
            <motion.span
              key={`${chip.id}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.6),
                type: 'spring',
                stiffness: 420,
                damping: 26,
              }}
              className={cx(
                'inline-flex flex-col items-stretch overflow-hidden rounded-md border',
                'border-accent/30 bg-accent/8',
              )}
            >
              <span className="whitespace-pre px-2 py-1 font-mono text-[13px] text-fg">
                {renderPiece(chip.text)}
              </span>
              <span className="border-t border-accent/20 bg-accent/6 px-2 py-0.5 text-center font-mono text-[10px] tabular-nums text-accent">
                {chip.id}
              </span>
            </motion.span>
          ))}
        </div>
      </div>
    </VizShell>
  );
};
