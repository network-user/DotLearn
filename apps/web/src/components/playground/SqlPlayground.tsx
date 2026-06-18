import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Database, Eraser, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { ResultGrid } from '@/components/sandbox/ResultGrid';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Surface } from '@/components/ui/Surface';
import { coarsePointerQuery, useMediaQuery } from '@/hooks/useMediaQuery';
import { buildEditorHeight, buildEditorOptions } from '@/lib/editor-options';
import { saveSqlState, type PlaygroundView, type SqlPlaygroundState } from '@/lib/playground';
import {
  defaultSqlTemplate,
  sqlTemplateById,
  sqlTemplates,
  type SqlTemplate,
} from '@/lib/sandbox-templates/sql';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { TemplatePicker, type TemplateOption } from './TemplatePicker';

interface SqlPlaygroundProps {
  initialState: SqlPlaygroundState;
}

interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'result'; result: SqlResult; durationMs: number }
  | { kind: 'error'; message: string };

const BLANK_SCHEMA = '';
const BLANK_QUERY = '';

export const SqlPlayground = ({ initialState }: SqlPlaygroundProps) => {
  const { t } = useTranslation('sandbox');
  const isCoarsePointer = useMediaQuery(coarsePointerQuery);
  const reduceMotion = useReducedMotion() ?? false;
  const [templateId, setTemplateId] = useState(initialState.templateId);
  const [schema, setSchema] = useState(initialState.schema);
  const [query, setQuery] = useState(initialState.query);
  const [view, setView] = useState<PlaygroundView>(initialState.view);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const runCounter = useRef(0);

  useEffect(() => {
    void saveSqlState({ templateId, schema, query, view });
  }, [templateId, schema, query, view]);

  const templateOptions: TemplateOption[] = useMemo(
    () =>
      sqlTemplates.map((template) => ({
        id: template.id,
        label: t(template.labelKey),
        description: t(template.descriptionKey),
      })),
    [t],
  );

  const applyTemplate = useCallback((template: SqlTemplate): void => {
    setTemplateId(template.id);
    setSchema(template.schema);
    setQuery(template.query);
    setState({ kind: 'idle' });
  }, []);

  const handleOpenTemplate = useCallback(
    (id: string): void => {
      if (id !== templateId) {
        applyTemplate(sqlTemplateById(id) ?? defaultSqlTemplate);
      }
      setView('workspace');
    },
    [applyTemplate, templateId],
  );

  const backToGallery = useCallback((): void => {
    setView('gallery');
  }, []);

  const handleReset = useCallback((): void => {
    applyTemplate(sqlTemplateById(templateId) ?? defaultSqlTemplate);
  }, [applyTemplate, templateId]);

  const handleClear = useCallback((): void => {
    setSchema(BLANK_SCHEMA);
    setQuery(BLANK_QUERY);
    setState({ kind: 'idle' });
  }, []);

  const handleRun = useCallback(async (): Promise<void> => {
    if (!query.trim()) {
      setState({ kind: 'error', message: t('sql.emptyQuery') });
      return;
    }
    const runId = ++runCounter.current;
    setState({ kind: 'running' });
    const startedAt = performance.now();
    try {
      const runtime = getSqlRuntime();
      const execution = await runtime.execute(query, schema || undefined);
      if (runId !== runCounter.current) return;
      setState({
        kind: 'result',
        result: { columns: execution.columns, rows: execution.rows },
        durationMs: performance.now() - startedAt,
      });
    } catch (caught) {
      if (runId !== runCounter.current) return;
      setState({
        kind: 'error',
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }, [query, schema, t]);

  const running = state.kind === 'running';
  const editorOptions = buildEditorOptions(isCoarsePointer, 2);
  const currentTemplate = sqlTemplateById(templateId) ?? defaultSqlTemplate;
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === 'gallery' ? (
        <motion.div key="gallery" {...motionProps} className="space-y-3">
          <p className="text-[13px] text-fg-muted">{t('gallery.choose')}</p>
          <TemplatePicker options={templateOptions} onOpen={handleOpenTemplate} icon={Database} />
        </motion.div>
      ) : (
        <motion.div key="workspace" {...motionProps} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ArrowLeft size={14} />}
              onClick={backToGallery}
              className="-ml-2 h-11 sm:h-8"
            >
              {t('actions.backToTemplates')}
            </Button>
            <span className="inline-flex min-w-0 items-center gap-1.5 eyebrow text-fg-subtle">
              <Database size={12} className="shrink-0 text-accent" />
              <span className="truncate">{t(currentTemplate.labelKey)}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Surface variant="paper" className="min-w-0 overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
                <span className="eyebrow flex items-center gap-1.5">
                  <Database size={12} className="text-accent" />
                  {t('sql.schemaLabel')}
                </span>
              </div>
              <LazyCodeEditor
                value={schema}
                onChange={(value) => setSchema(value ?? '')}
                language="sql"
                height={buildEditorHeight(isCoarsePointer, '220px', 'min(34dvh, 300px)')}
                options={editorOptions}
              />
            </Surface>

            <Surface variant="paper" className="min-w-0 overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
                <span className="eyebrow font-mono">{t('sql.queryLabel')}</span>
                {!isCoarsePointer && (
                  <span className="text-[10.5px] text-fg-subtle">ctrl + enter</span>
                )}
              </div>
              <LazyCodeEditor
                value={query}
                onChange={(value) => setQuery(value ?? '')}
                language="sql"
                sqlSchema={schema}
                height={buildEditorHeight(isCoarsePointer, '220px', 'min(34dvh, 300px)')}
                options={editorOptions}
                onMount={(editor) => {
                  editor.onKeyDown((event) => {
                    if ((event.ctrlKey || event.metaKey) && event.code === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleRun();
                    }
                  });
                }}
              />
            </Surface>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Play size={14} />}
              loading={running}
              onClick={handleRun}
              className="h-11 flex-1 sm:h-8 sm:flex-initial"
            >
              {running ? t('sql.running') : t('sql.run')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw size={13} />}
              onClick={handleReset}
              className="h-11 sm:h-8"
            >
              {t('actions.resetTemplate')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Eraser size={13} />}
              onClick={handleClear}
              className="h-11 sm:h-8"
            >
              {t('actions.clear')}
            </Button>
            {state.kind === 'result' && (
              <span className="ml-auto text-[12px] tabular-nums text-fg-subtle">
                {t('sql.resultMeta', {
                  rows: state.result.rows.length,
                  ms: Math.round(state.durationMs),
                })}
              </span>
            )}
          </div>

          <Surface variant="inset" className="min-w-0 overflow-hidden p-0">
            <div className="border-b border-border-base/60 px-3 py-2">
              <span className="eyebrow text-fg-subtle">{t('sql.resultLabel')}</span>
            </div>
            <div className="p-3">
              {state.kind === 'idle' && (
                <p className="text-[12.5px] italic text-fg-subtle">{t('sql.idle')}</p>
              )}
              {state.kind === 'running' && (
                <p className="text-[12.5px] text-fg-subtle">{t('sql.running')}</p>
              )}
              {state.kind === 'error' && (
                <p
                  className={cx(
                    'rounded-lg border border-err/30 bg-err/8 px-3 py-2',
                    'whitespace-pre-wrap font-mono text-[12.5px] text-err',
                  )}
                >
                  {state.message}
                </p>
              )}
              {state.kind === 'result' && (
                <ResultGrid
                  columns={state.result.columns}
                  rows={state.result.rows}
                  emptyMessage={t('sql.noRows')}
                  compact
                />
              )}
            </div>
          </Surface>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
