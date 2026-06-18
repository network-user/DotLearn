import { useEffect, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Shuffle } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

import { bits32, fnv1a, popcount, toHex, type VizLang } from './hash-utils';

export interface HashFunctionVizProps {
  initialText?: string;
  label?: string;
  lang?: VizLang;
}

const STRINGS = {
  ru: {
    label: 'Хеш-функция: вход → отпечаток',
    mutate: 'изменить один символ',
    inputLabel: 'вход (любой длины)',
    outputLabel: 'хеш (фиксированные 32 бита)',
    bitsLabel: 'биты выхода',
    alphabet: 'абвгдеёжзийклмнопрстуфхцчшщэюя',
    defaultText: 'Москва',
    changed: (n: number) => (
      <span>
        Один и тот же вход всегда даёт один и тот же хеш. А вот соседний вход поменял{' '}
        <strong className="text-accent">{n}</strong> из 32 бит - в этом и есть лавинный эффект:
        похожие входы дают непохожие хеши.
      </span>
    ),
    idle: 'Введите любой текст: хеш меняется при каждом нажатии, но длина выхода всегда одна и та же - 32 бита, 8 шестнадцатеричных цифр.',
  },
  en: {
    label: 'Hash function: input → fingerprint',
    mutate: 'change one character',
    inputLabel: 'input (any length)',
    outputLabel: 'hash (fixed 32 bits)',
    bitsLabel: 'output bits',
    alphabet: 'abcdefghijklmnopqrstuvwxyz',
    defaultText: 'Moscow',
    changed: (n: number) => (
      <span>
        The same input always produces the same hash. But a neighbouring input flipped{' '}
        <strong className="text-accent">{n}</strong> of 32 bits - that is the avalanche effect:
        similar inputs give dissimilar hashes.
      </span>
    ),
    idle: 'Type any text: the hash changes on every keystroke, but the output length is always the same - 32 bits, 8 hex digits.',
  },
} as const;

const mutateOneChar = (text: string, alphabet: string): string => {
  if (text.length === 0) return alphabet[0] ?? 'a';
  const index = Math.floor(Math.random() * text.length);
  const chars = [...text];
  const original = chars[index] ?? '';
  let replacement = original;
  while (replacement === original) {
    replacement = alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'a';
  }
  chars[index] = replacement;
  return chars.join('');
};

export const HashFunctionViz = ({ initialText, label, lang = 'ru' }: HashFunctionVizProps) => {
  const t = STRINGS[lang];
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(initialText ?? t.defaultText);
  const prevHashRef = useRef<number>(fnv1a(initialText ?? t.defaultText));
  const [changed, setChanged] = useState(0);

  const hash = fnv1a(text);
  const bits = bits32(hash);
  const prevBits = bits32(prevHashRef.current);

  useEffect(() => {
    const diff = popcount(hash ^ prevHashRef.current);
    if (prevHashRef.current !== hash) {
      setChanged(diff);
    }
    prevHashRef.current = hash;
  }, [hash]);

  return (
    <VizShell
      label={label ?? t.label}
      actions={
        <VizButton onClick={() => setText((current) => mutateOneChar(current, t.alphabet))} tone="ghost">
          <Shuffle size={12} />
          {t.mutate}
        </VizButton>
      }
      footer={changed > 0 ? t.changed(changed) : <span>{t.idle}</span>}
    >
      <div className="min-w-[300px] space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-fg-subtle" htmlFor="hashfn-input">
            {t.inputLabel}
          </label>
          <input
            id="hashfn-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 font-mono text-[16px] sm:text-sm text-fg focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{t.outputLabel}</span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-fg-subtle text-sm">0x</span>
            <div className="flex gap-0.5 text-[20px] sm:text-2xl font-semibold tracking-wide">
              {toHex(hash).split('').map((digit, i) => (
                <motion.span
                  key={`${i}-${digit}`}
                  initial={reduceMotion ? false : { y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="text-accent"
                >
                  {digit}
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{t.bitsLabel}</span>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
            {bits.map((bit, i) => {
              const flipped = bit !== prevBits[i];
              return (
                <motion.span
                  key={i}
                  animate={reduceMotion ? {} : { scale: flipped && changed > 0 ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                  className={cx(
                    'aspect-square rounded-[3px] border',
                    bit === 1 ? 'border-accent/40 bg-accent/70' : 'border-border-base bg-surface-2',
                    flipped && changed > 0 && 'ring-2 ring-warn/70',
                  )}
                  aria-hidden
                />
              );
            })}
          </div>
        </div>
      </div>
    </VizShell>
  );
};
