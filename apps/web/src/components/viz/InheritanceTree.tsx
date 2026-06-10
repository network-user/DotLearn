import { useEffect, useMemo, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

interface TreeNode {
  id: string;
  label: string;
  parent?: string | null;
  methods: string[];
}

interface InheritanceTreeProps {
  nodes?: TreeNode[];
  from?: string;
  phantomMethod?: string;
  label?: string;
}

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching'; method: string; step: number }
  | { kind: 'found'; method: string; nodeId: string }
  | { kind: 'missing'; method: string };

const defaultNodes: TreeNode[] = [
  { id: 'animal', label: 'Animal', parent: null, methods: ['eat()', 'sleep()'] },
  { id: 'dog', label: 'Dog', parent: 'animal', methods: ['bark()'] },
  { id: 'puppy', label: 'Puppy', parent: 'dog', methods: ['whine()'] },
];

const STEP_MS = 650;

export const InheritanceTree = ({
  nodes = defaultNodes,
  from,
  phantomMethod = 'fly()',
  label,
}: InheritanceTreeProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const timerRef = useRef<number | null>(null);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const startId = from ?? nodes[nodes.length - 1]?.id;

  const chain = useMemo(() => {
    const result: TreeNode[] = [];
    let cursor = startId ? byId.get(startId) : undefined;
    while (cursor) {
      result.push(cursor);
      cursor = cursor.parent ? byId.get(cursor.parent) : undefined;
    }
    return result;
  }, [byId, startId]);

  const allMethods = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const node of chain) {
      for (const method of node.methods) {
        if (!seen.has(method)) {
          seen.add(method);
          list.push(method);
        }
      }
    }
    list.push(phantomMethod);
    return list;
  }, [chain, phantomMethod]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const startLookup = (method: string): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (reduceMotion) {
      const owner = chain.find((node) => node.methods.includes(method));
      setLookup(owner ? { kind: 'found', method, nodeId: owner.id } : { kind: 'missing', method });
      return;
    }
    const advance = (step: number): void => {
      const node = chain[step];
      if (!node) {
        setLookup({ kind: 'missing', method });
        return;
      }
      setLookup({ kind: 'searching', method, step });
      timerRef.current = window.setTimeout(() => {
        if (node.methods.includes(method)) {
          setLookup({ kind: 'found', method, nodeId: node.id });
        } else {
          advance(step + 1);
        }
      }, STEP_MS);
    };
    advance(0);
  };

  const childrenOf = (parentId: string | null): TreeNode[] =>
    nodes.filter((node) => (node.parent ?? null) === parentId);

  const renderNode = (node: TreeNode, depth: number): JSX.Element => {
    const searchingHere =
      lookup.kind === 'searching' && chain[lookup.step]?.id === node.id;
    const foundHere = lookup.kind === 'found' && lookup.nodeId === node.id;
    const inChain = chain.some((chainNode) => chainNode.id === node.id);

    return (
      <div key={node.id} className={cx(depth > 0 && 'ml-6 pl-4 border-l border-border-base/70')}>
        <motion.div
          animate={
            searchingHere
              ? { scale: 1.02 }
              : { scale: 1 }
          }
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={cx(
            'inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 my-1.5 transition-shadow duration-fast',
            foundHere
              ? 'border-ok/60 bg-ok/10'
              : searchingHere
                ? 'border-accent/60 bg-accent/10'
                : inChain
                  ? 'border-border-strong bg-surface-2'
                  : 'border-border-base bg-surface opacity-70',
          )}
        >
          <span className="font-mono text-[13px] font-semibold text-fg">{node.label}</span>
          <span className="flex flex-wrap gap-1">
            {node.methods.map((method) => (
              <span
                key={method}
                className={cx(
                  'rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors duration-fast',
                  foundHere && lookup.kind === 'found' && lookup.method === method
                    ? 'bg-ok/20 text-ok'
                    : 'bg-surface-2 text-fg-muted',
                )}
              >
                {method}
              </span>
            ))}
          </span>
        </motion.div>
        {childrenOf(node.id).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const footer = (() => {
    switch (lookup.kind) {
      case 'idle':
        return t('mro.idle');
      case 'searching':
        return t('mro.searching', { method: lookup.method, cls: chain[lookup.step]?.label ?? '' });
      case 'found':
        return t('mro.found', { method: lookup.method, cls: byId.get(lookup.nodeId)?.label ?? '' });
      case 'missing':
        return <span className="text-err">{t('mro.missing', { method: lookup.method })}</span>;
    }
  })();

  return (
    <VizShell label={label ?? t('mro.label')} footer={footer}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_max-content] gap-4 items-start">
        <div>{childrenOf(null).map((root) => renderNode(root, 0))}</div>
        <div className="flex md:flex-col flex-wrap gap-1.5 md:min-w-[140px]">
          {allMethods.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => startLookup(method)}
              disabled={lookup.kind === 'searching'}
              className={cx(
                'rounded-md border border-border-base bg-surface px-2.5 py-1.5 font-mono text-[12px] text-left transition-colors duration-fast',
                'hover:border-accent/50 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed',
                lookup.kind !== 'idle' && lookup.method === method ? 'text-accent border-accent/50' : 'text-fg-muted',
              )}
            >
              {chain[0] ? `${chain[0].label.toLowerCase()}.${method}` : method}
            </button>
          ))}
        </div>
      </div>
    </VizShell>
  );
};
