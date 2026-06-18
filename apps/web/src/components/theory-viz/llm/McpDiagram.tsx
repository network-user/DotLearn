import { useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';
import { Boxes, FileText, MessageSquare, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { VizShell } from '@/components/viz/VizShell';

export type McpCapability = 'tools' | 'resources' | 'prompts';

export interface McpServer {
  name: string;
  capabilities: McpCapability[];
  detail?: string;
}

export interface McpDiagramProps {
  servers?: McpServer[];
  label?: string;
  hostLabel?: string;
  hostDetail?: string;
  emptyHint?: string;
}

const defaultServers: McpServer[] = [
  {
    name: 'Файловая система',
    capabilities: ['resources', 'tools'],
    detail: 'Читает файлы как ресурсы и пишет их инструментами.',
  },
  {
    name: 'GitHub',
    capabilities: ['tools', 'resources'],
    detail: 'Issue и PR как инструменты, репозитории как ресурсы.',
  },
  {
    name: 'База знаний',
    capabilities: ['resources', 'prompts'],
    detail: 'Документы-ресурсы и готовые шаблоны-промпты.',
  },
];

const capabilityMeta: Record<McpCapability, { label: string; Icon: LucideIcon }> = {
  tools: { label: 'Инструменты', Icon: Wrench },
  resources: { label: 'Ресурсы', Icon: FileText },
  prompts: { label: 'Промпты', Icon: MessageSquare },
};

export const McpDiagram = ({
  servers = defaultServers,
  label = 'Протокол MCP',
  hostLabel = 'Хост и клиент',
  hostDetail = 'Приложение с LLM открывает по одному клиенту на сервер.',
  emptyHint = 'Наведите на сервер, чтобы увидеть, что он предоставляет.',
}: McpDiagramProps) => {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const activeServer = active !== null ? servers[active] : null;

  return (
    <VizShell
      label={label}
      footer={
        activeServer ? (
          <span>
            <span className="font-mono text-accent">{activeServer.name}</span>
            {activeServer.detail ? (
              <>
                <span className="text-fg-subtle"> · </span>
                <span className="text-fg-muted">{activeServer.detail}</span>
              </>
            ) : null}
          </span>
        ) : (
          emptyHint
        )
      }
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={cx(
            'shrink-0 rounded-lg border-2 px-4 py-3 transition-colors duration-med',
            active !== null ? 'border-accent bg-accent/8' : 'border-border-strong bg-surface-2',
          )}
        >
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-accent" />
            <span className="font-display text-[14px] font-semibold text-fg">{hostLabel}</span>
          </div>
          <p className="mt-1 max-w-[200px] text-[12px] leading-relaxed text-fg-muted">
            {hostDetail}
          </p>
        </div>

        <div className="hidden flex-1 flex-col items-center sm:flex" aria-hidden>
          <motion.div
            className="h-px w-full origin-left bg-gradient-to-r from-accent/60 to-border-strong"
            animate={reduceMotion ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            JSON-RPC
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5">
          {servers.map((server, index) => {
            const isActive = active === index;
            return (
              <motion.button
                key={server.name}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(isActive ? null : index)}
                initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.08,
                  type: 'spring',
                  stiffness: 320,
                  damping: 26,
                }}
                className={cx(
                  'min-h-[var(--tap)] rounded-lg border px-3 py-2 text-left transition-colors duration-fast sm:min-h-0',
                  isActive
                    ? 'border-accent/60 bg-accent/8'
                    : 'border-border-base bg-surface hover:border-accent/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                    MCP
                  </span>
                  <span className="font-display text-[13.5px] font-semibold text-fg">
                    {server.name}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {server.capabilities.map((capability) => {
                    const meta = capabilityMeta[capability];
                    const Icon = meta.Icon;
                    return (
                      <span
                        key={capability}
                        className={cx(
                          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
                          'border-accent/30 bg-accent/6 text-accent',
                        )}
                      >
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </VizShell>
  );
};
