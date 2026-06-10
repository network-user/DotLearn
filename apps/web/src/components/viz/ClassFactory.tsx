import { useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { VizButton, VizShell } from './VizShell';

interface FactoryAttr {
  name: string;
  samples: string[];
}

interface ClassFactoryProps {
  className?: string;
  attrs?: FactoryAttr[];
  methods?: string[];
  label?: string;
}

interface FactoryInstance {
  seq: number;
  values: string[];
}

const MAX_INSTANCES = 4;

const defaultAttrs: FactoryAttr[] = [
  { name: 'name', samples: ['"Rex"', '"Bobik"', '"Lady"', '"Sharik"'] },
  { name: 'age', samples: ['3', '5', '1', '7'] },
];

export const ClassFactory = ({
  className = 'Dog',
  attrs = defaultAttrs,
  methods = ['bark()'],
  label,
}: ClassFactoryProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [instances, setInstances] = useState<FactoryInstance[]>([]);
  const [nextSeq, setNextSeq] = useState(0);

  const instantiate = (): void => {
    setInstances((current) => {
      if (current.length >= MAX_INSTANCES) return current;
      return [
        ...current,
        {
          seq: nextSeq,
          values: attrs.map((attr) => attr.samples[nextSeq % attr.samples.length] ?? '?'),
        },
      ];
    });
    setNextSeq((seq) => seq + 1);
  };

  const remove = (seq: number): void => {
    setInstances((current) => current.filter((instance) => instance.seq !== seq));
  };

  const atLimit = instances.length >= MAX_INSTANCES;

  return (
    <VizShell
      label={label ?? t('factory.label')}
      actions={
        <VizButton onClick={instantiate} disabled={atLimit}>
          <Plus size={12} />
          {t('factory.instantiate')}
        </VizButton>
      }
      footer={atLimit ? t('factory.limit') : instances.length === 0 ? t('factory.empty') : null}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-4 items-start">
        <div className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 px-4 py-3 sm:min-w-[180px]">
          <div className="text-[10px] uppercase tracking-widest text-accent/80 mb-1.5">
            class · {t('factory.blueprint')}
          </div>
          <div className="font-mono text-[13px] text-fg font-semibold mb-2">{className}</div>
          <ul className="space-y-1 font-mono text-[12px] text-fg-muted">
            {attrs.map((attr) => (
              <li key={attr.name}>
                <span className="text-accent">{attr.name}</span> = ?
              </li>
            ))}
            {methods.map((method) => (
              <li key={method} className="text-fg-subtle">
                {method}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 min-h-[96px]">
          <AnimatePresence mode="popLayout">
            {instances.map((instance) => (
              <motion.div
                key={instance.seq}
                layout
                initial={
                  reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7, x: -32, filter: 'blur(4px)' }
                }
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }
                }
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="group relative rounded-lg border border-border-base bg-surface-2 px-3.5 py-2.5 shadow-card"
              >
                <button
                  type="button"
                  onClick={() => remove(instance.seq)}
                  aria-label="remove"
                  className="absolute -top-1.5 -right-1.5 grid place-items-center size-5 rounded-full bg-surface-3 text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity duration-fast"
                >
                  <X size={10} />
                </button>
                <div className="text-[10px] font-mono text-fg-subtle mb-1">
                  {className.toLowerCase()}
                  {instance.seq + 1} · id 0x{(0x55f3a0 + instance.seq * 0x40).toString(16)}
                </div>
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {attrs.map((attr, attrIndex) => (
                    <li key={attr.name}>
                      <span className="text-accent">{attr.name}</span>
                      <span className="text-fg-subtle"> = </span>
                      <span className="text-fg">{instance.values[attrIndex]}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </VizShell>
  );
};
