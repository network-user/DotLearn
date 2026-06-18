import { useMemo, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

import { fnv1a, type VizLang } from './hash-utils';

export interface CollisionVizProps {
  size?: number;
  keys?: string[];
  label?: string;
  lang?: VizLang;
}

type Mode = 'chaining' | 'probing';

interface LastInsert {
  key: string;
  home: number;
  placed: number;
  path: number[];
  collision: boolean;
}

const STRINGS = {
  ru: {
    label: 'Разрешение коллизий',
    chaining: 'цепочки',
    probing: 'открытая адресация',
    insert: 'вставить',
    reset: 'сброс',
    defaultKeys: ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина', 'Егор'],
    queue: 'в очереди',
    allInserted: 'все ключи вставлены',
    homeChain: (key: string, home: number, collision: boolean) =>
      collision
        ? `${key} метит в корзину ${home}. Корзина занята - ключ дописывается в связанный список (цепочку).`
        : `${key} метит в корзину ${home}. Корзина свободна - ключ кладётся первым в цепочку.`,
    homeProbe: (key: string, home: number, placed: number, len: number, collision: boolean) =>
      collision
        ? `${key} метит в корзину ${home}. Занято - пробуем следующие ячейки по кругу и садимся в ${placed} (длина пробы ${len}).`
        : `${key} метит в корзину ${home}. Свободно - ключ кладётся сразу, без пробинга.`,
    introChain: 'Цепочки: каждая корзина хранит список. Коллизии складываются в один список.',
    introProbe:
      'Открытая адресация: один ключ на ячейку. При занятой ячейке ищем следующую свободную - так растут кластеры.',
  },
  en: {
    label: 'Collision resolution',
    chaining: 'chaining',
    probing: 'open addressing',
    insert: 'insert',
    reset: 'reset',
    defaultKeys: ['Anna', 'Boris', 'Vera', 'Gleb', 'Dina', 'Egor'],
    queue: 'queued',
    allInserted: 'all keys inserted',
    homeChain: (key: string, home: number, collision: boolean) =>
      collision
        ? `${key} aims for bucket ${home}. It's taken - the key is appended to the linked list (chain).`
        : `${key} aims for bucket ${home}. It's free - the key goes first into the chain.`,
    homeProbe: (key: string, home: number, placed: number, len: number, collision: boolean) =>
      collision
        ? `${key} aims for bucket ${home}. Taken - we probe the next cells around the ring and land in ${placed} (probe length ${len}).`
        : `${key} aims for bucket ${home}. Free - the key is placed at once, no probing.`,
    introChain: 'Chaining: each bucket holds a list. Collisions pile into one list.',
    introProbe:
      'Open addressing: one key per cell. When a cell is taken we look for the next free one - that is how clusters grow.',
  },
} as const;

export const CollisionViz = ({ size = 7, keys, label, lang = 'ru' }: CollisionVizProps) => {
  const t = STRINGS[lang];
  const initialKeys = keys ?? t.defaultKeys;
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>('chaining');
  const [chains, setChains] = useState<string[][]>(() => Array.from({ length: size }, () => []));
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: size }, () => null),
  );
  const [queue, setQueue] = useState<string[]>([...initialKeys]);
  const [last, setLast] = useState<LastInsert | null>(null);

  const reset = (next: Mode = mode): void => {
    setMode(next);
    setChains(Array.from({ length: size }, () => []));
    setSlots(Array.from({ length: size }, () => null));
    setQueue([...initialKeys]);
    setLast(null);
  };

  const step = (): void => {
    const key = queue[0];
    if (key === undefined) return;
    const home = fnv1a(key) % size;

    if (mode === 'chaining') {
      const collision = (chains[home]?.length ?? 0) > 0;
      setChains((current) => current.map((cell, i) => (i === home ? [...cell, key] : cell)));
      setLast({ key, home, placed: home, path: [home], collision });
      setQueue((current) => current.slice(1));
      return;
    }

    let index = home;
    const path = [home];
    let guard = 0;
    while ((slots[index] ?? null) !== null && guard < size) {
      index = (index + 1) % size;
      path.push(index);
      guard += 1;
    }
    if ((slots[index] ?? null) !== null) return;
    const target = index;
    setSlots((current) => current.map((value, i) => (i === target ? key : value)));
    setLast({ key, home, placed: target, path, collision: path.length > 1 });
    setQueue((current) => current.slice(1));
  };

  const probePath = useMemo(() => new Set(last?.path ?? []), [last]);
  const filled = mode === 'chaining' ? chains : slots;
  const done = queue.length === 0;

  return (
    <VizShell
      label={label ?? t.label}
      actions={
        <>
          <VizButton
            onClick={() => reset('chaining')}
            tone={mode === 'chaining' ? 'accent' : 'ghost'}
          >
            {t.chaining}
          </VizButton>
          <VizButton
            onClick={() => reset('probing')}
            tone={mode === 'probing' ? 'accent' : 'ghost'}
          >
            {t.probing}
          </VizButton>
          <VizButton onClick={step} disabled={done}>
            {t.insert}
          </VizButton>
          <VizButton onClick={() => reset()} tone="ghost">
            <RotateCcw size={11} />
            {t.reset}
          </VizButton>
        </>
      }
      footer={
        last ? (
          <span key={`${last.key}-${last.placed}`}>
            {mode === 'chaining'
              ? t.homeChain(last.key, last.home, last.collision)
              : t.homeProbe(last.key, last.home, last.placed, last.path.length, last.collision)}
          </span>
        ) : (
          <span>{mode === 'chaining' ? t.introChain : t.introProbe}</span>
        )
      }
    >
      <div className="min-w-[320px]">
        <div className="mb-2 text-[12px] text-fg-subtle">
          {queue.length > 0 ? (
            <>
              {t.queue}: <code className="text-accent">{queue[0]}</code>
              {queue.length > 1 ? ` (+${queue.length - 1})` : ''}
            </>
          ) : (
            t.allInserted
          )}
        </div>

        <div className="flex gap-2">
          {filled.map((cell, index) => {
            const onPath = mode === 'probing' && probePath.has(index);
            const isHome = last?.home === index;
            const isPlaced = last?.placed === index;
            return (
              <div key={index} className="flex flex-1 flex-col gap-1">
                <div
                  className={cx(
                    'rounded-t-md border-x border-t px-1 py-0.5 text-center font-mono text-[11px]',
                    isHome
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-base bg-surface-2 text-fg-subtle',
                  )}
                >
                  {index}
                </div>
                {mode === 'chaining' ? (
                  <div className="flex min-h-[140px] flex-col gap-1 rounded-b-md border border-border-base bg-surface px-1 py-1.5">
                    <AnimatePresence>
                      {(cell as string[]).map((key, depth) => (
                        <motion.span
                          key={key}
                          initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cx(
                            'truncate rounded px-1 py-0.5 text-center font-mono text-[10.5px]',
                            depth === 0 ? 'bg-accent/12 text-accent' : 'bg-warn/15 text-warn',
                          )}
                        >
                          {key}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <motion.div
                    animate={reduceMotion ? {} : { scale: isPlaced ? [1, 1.08, 1] : 1 }}
                    className={cx(
                      'flex min-h-[140px] items-center justify-center rounded-b-md border px-1 py-1.5 text-center font-mono text-[10.5px]',
                      cell
                        ? 'border-accent/40 bg-accent/[0.08] text-accent'
                        : onPath
                          ? 'border-warn/50 bg-warn/10 text-warn'
                          : 'border-border-base bg-surface text-fg-subtle',
                    )}
                  >
                    {(cell as string | null) ?? (onPath ? '×' : '')}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </VizShell>
  );
};
