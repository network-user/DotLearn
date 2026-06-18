import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eraser,
  FilePlus2,
  History,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  Terminal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { PythonConsole, type ConsoleLine } from '@/components/sandbox/PythonConsole';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { cx } from '@/components/ui/cx';
import { coarsePointerQuery, useMediaQuery } from '@/hooks/useMediaQuery';
import { buildEditorHeight, buildEditorOptions } from '@/lib/editor-options';
import {
  createPythonSnippet,
  deletePythonSnippet,
  listPythonSnippets,
  renamePythonSnippet,
  savePythonState,
  updatePythonSnippetCode,
  type PersistedConsoleLine,
  type PersistedConsoleTone,
  type PlaygroundSnippet,
  type PlaygroundView,
  type PythonPlaygroundState,
} from '@/lib/playground';
import {
  formatReplValue,
  importedModules,
  importedPyodidePackages,
  isKnownPyodidePackage,
  moduleNameFromError,
  PYODIDE_PACKAGES,
  splitTrailingExpression,
} from '@/lib/python-repl';
import { getPythonRuntime, terminatePythonRuntime } from '@/lib/python-runtime';
import {
  defaultPythonTemplate,
  pythonTemplateById,
  pythonTemplates,
  type PythonTemplate,
} from '@/lib/sandbox-templates/python';
import { useSettings } from '@/lib/settings';

import { TemplatePicker, type TemplateOption } from './TemplatePicker';

interface PythonPlaygroundProps {
  initialState: PythonPlaygroundState;
}

type RunStatus = 'idle' | 'loading' | 'running' | 'pass' | 'fail';

type HistoryStatus = 'pass' | 'fail' | 'stopped';

interface RunHistoryEntry {
  id: string;
  at: number;
  code: string;
  status: HistoryStatus;
  durationMs: number;
  outputPreview: string;
}

const HISTORY_LIMIT = 10;

const PERSISTED_TONES: PersistedConsoleTone[] = ['system', 'stdout', 'pass', 'fail', 'meta'];

const toPersistedLines = (lines: ConsoleLine[]): PersistedConsoleLine[] =>
  lines
    .filter((line) => PERSISTED_TONES.includes(line.tone as PersistedConsoleTone))
    .map((line) => ({ tone: line.tone as PersistedConsoleTone, text: line.text }));

const fromPersistedLines = (lines: PersistedConsoleLine[] | undefined): ConsoleLine[] =>
  (lines ?? []).map((line, index) => ({
    id: `restored-${index}`,
    tone: line.tone,
    text: line.text,
  }));

const splitStdout = (text: string, prefix: string): ConsoleLine[] =>
  text
    .split('\n')
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ''))
    .map((line, index) => ({ id: `${prefix}-${index}`, tone: 'stdout' as const, text: line }));

const previewOutput = (lines: ConsoleLine[]): string => {
  const body = lines
    .filter((line) => line.tone === 'stdout' || line.tone === 'fail' || line.tone === 'meta')
    .map((line) => line.text)
    .join(' · ');
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
};

const isTimeoutMessage = (message: string): boolean =>
  message.includes('exceeded') && message.includes('terminated');

export const PythonPlayground = ({ initialState }: PythonPlaygroundProps) => {
  const { t } = useTranslation('sandbox');
  const isCoarsePointer = useMediaQuery(coarsePointerQuery);
  const editorPrefs = useSettings().editor;
  const reduceMotion = useReducedMotion() ?? false;
  const [templateId, setTemplateId] = useState(initialState.templateId);
  const [code, setCode] = useState(initialState.code);
  const [view, setView] = useState<PlaygroundView>(initialState.view);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<ConsoleLine[]>(() =>
    fromPersistedLines(initialState.lastLines),
  );
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snippets, setSnippets] = useState<PlaygroundSnippet[]>([]);
  const [activeSnippetId, setActiveSnippetId] = useState<string | undefined>(
    initialState.activeSnippetId,
  );
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);
  const [clearedBackup, setClearedBackup] = useState<{ code: string; lines: ConsoleLine[] } | null>(
    null,
  );

  const session = useRef(0);
  const stopRequested = useRef(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const snippetMenuRef = useRef<HTMLDivElement | null>(null);
  const handleRunRef = useRef<(override?: string) => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    void listPythonSnippets().then((items) => {
      if (!cancelled) setSnippets(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void savePythonState({
      templateId,
      code,
      view,
      lastLines: toPersistedLines(lines),
      ...(activeSnippetId ? { activeSnippetId } : {}),
    });
  }, [templateId, code, view, lines, activeSnippetId]);

  useEffect(() => {
    if (!activeSnippetId) return;
    const timer = setTimeout(() => {
      void updatePythonSnippetCode(activeSnippetId, code);
      setSnippets((prev) =>
        prev.map((item) =>
          item.id === activeSnippetId
            ? { ...item, code, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [activeSnippetId, code]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (!snippetMenuOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (snippetMenuRef.current && !snippetMenuRef.current.contains(event.target as Node)) {
        setSnippetMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [snippetMenuOpen]);

  const templateOptions: TemplateOption[] = useMemo(
    () =>
      pythonTemplates.map((template) => ({
        id: template.id,
        label: t(template.labelKey),
        description: t(template.descriptionKey),
      })),
    [t],
  );

  const activeSnippet = useMemo(
    () => snippets.find((item) => item.id === activeSnippetId),
    [snippets, activeSnippetId],
  );

  const detectedPackages = useMemo(() => importedPyodidePackages(code), [code]);

  const applyTemplate = useCallback((template: PythonTemplate): void => {
    setTemplateId(template.id);
    setCode(template.code);
    setStatus('idle');
    setLines([]);
    setActiveSnippetId(undefined);
    setClearedBackup(null);
  }, []);

  const handleOpenTemplate = useCallback(
    (id: string): void => {
      if (id !== templateId || activeSnippetId) {
        applyTemplate(pythonTemplateById(id) ?? defaultPythonTemplate);
      }
      setView('workspace');
    },
    [applyTemplate, templateId, activeSnippetId],
  );

  const backToGallery = useCallback((): void => {
    setView('gallery');
  }, []);

  const handleReset = useCallback((): void => {
    applyTemplate(pythonTemplateById(templateId) ?? defaultPythonTemplate);
  }, [applyTemplate, templateId]);

  const handleClear = useCallback((): void => {
    setClearedBackup({ code, lines });
    setCode('');
    setStatus('idle');
    setLines([]);
  }, [code, lines]);

  const handleUndoClear = useCallback((): void => {
    if (!clearedBackup) return;
    setCode(clearedBackup.code);
    setLines(clearedBackup.lines);
    setClearedBackup(null);
  }, [clearedBackup]);

  const handleNewBlank = useCallback((): void => {
    setTemplateId('blank');
    setCode('');
    setStatus('idle');
    setLines([]);
    setActiveSnippetId(undefined);
    setClearedBackup(null);
    setView('workspace');
  }, []);

  const handleStop = useCallback((): void => {
    if (status !== 'running' && status !== 'loading') return;
    stopRequested.current = true;
    terminatePythonRuntime();
  }, [status]);

  const pushHistory = useCallback((entry: Omit<RunHistoryEntry, 'id' | 'at'>): void => {
    setHistory((prev) =>
      [
        {
          ...entry,
          id: `run-${session.current}-${Date.now()}`,
          at: Date.now(),
        },
        ...prev,
      ].slice(0, HISTORY_LIMIT),
    );
  }, []);

  const handleRun = useCallback(
    async (override?: string): Promise<void> => {
      const codeSnapshot = override ?? code;
      if (override !== undefined) {
        setCode(override);
        setActiveSnippetId(undefined);
      }
      const sid = (session.current += 1);
      stopRequested.current = false;
      setClearedBackup(null);
      setStatus('loading');
      setLines([{ id: `s${sid}-load`, tone: 'system', text: t('python.consoleLoad') }]);
      const knownPkgs = importedModules(codeSnapshot).filter(isKnownPyodidePackage);
      if (knownPkgs.length > 0) {
        setLines((prev) => [
          ...prev,
          {
            id: `s${sid}-pkg-hint`,
            tone: 'system',
            text: t('python.loadingPackages', { packages: knownPkgs.join(', ') }),
          },
        ]);
      }
      const startedAt = performance.now();
      const { body, echoExpression } = splitTrailingExpression(codeSnapshot);
      try {
        const runtime = getPythonRuntime();
        await runtime.init();
        setStatus('running');
        const execution = await runtime.evaluate(body, echoExpression ?? 'None');
        const durationMs = Math.round(performance.now() - startedAt);
        const next: ConsoleLine[] = [];
        const stdout = execution.stdout ?? '';
        if (stdout) {
          next.push(...splitStdout(stdout, `s${sid}-out`));
        }
        if (execution.thrown) {
          const moduleName = moduleNameFromError(execution.thrown.type, execution.thrown.message);
          if (moduleName) {
            next.push({
              id: `s${sid}-err`,
              tone: 'fail',
              text: t('python.moduleNotFound', { module: moduleName }),
            });
          } else {
            next.push({
              id: `s${sid}-err`,
              tone: 'fail',
              text: `${execution.thrown.type}: ${execution.thrown.message}`,
            });
          }
          next.push({
            id: `s${sid}-meta`,
            tone: 'meta',
            text: t('python.consoleFailed', { ms: durationMs }),
          });
          setLines((prev) => {
            const merged = [...prev, ...next];
            pushHistory({
              code: codeSnapshot,
              status: 'fail',
              durationMs,
              outputPreview: previewOutput(merged),
            });
            return merged;
          });
          setStatus('fail');
          return;
        }
        if (echoExpression && execution.result !== undefined && execution.result !== null) {
          next.push({
            id: `s${sid}-val`,
            tone: 'meta',
            text: `→ ${formatReplValue(execution.result)}`,
          });
        }
        if (next.length === 0) {
          next.push({ id: `s${sid}-empty`, tone: 'system', text: t('python.consoleNoOutput') });
        }
        next.push({
          id: `s${sid}-done`,
          tone: 'meta',
          text: t('python.consoleDone', { ms: durationMs }),
        });
        setLines((prev) => {
          const merged = [...prev, ...next];
          pushHistory({
            code: codeSnapshot,
            status: 'pass',
            durationMs,
            outputPreview: previewOutput(merged),
          });
          return merged;
        });
        setStatus('pass');
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        const message = error instanceof Error ? error.message : String(error);
        if (stopRequested.current) {
          stopRequested.current = false;
          setLines((prev) => {
            const merged: ConsoleLine[] = [
              ...prev,
              { id: `s${sid}-stopped`, tone: 'fail', text: t('python.stopped') },
            ];
            pushHistory({
              code: codeSnapshot,
              status: 'stopped',
              durationMs,
              outputPreview: previewOutput(merged),
            });
            return merged;
          });
          setStatus('fail');
          return;
        }
        const friendly = isTimeoutMessage(message) ? t('python.timeout') : `[runtime] ${message}`;
        setLines((prev) => {
          const merged: ConsoleLine[] = [
            ...prev,
            {
              id: `s${sid}-runtime`,
              tone: 'fail',
              text: friendly,
            },
          ];
          pushHistory({
            code: codeSnapshot,
            status: isTimeoutMessage(message) ? 'stopped' : 'fail',
            durationMs,
            outputPreview: previewOutput(merged),
          });
          return merged;
        });
        setStatus('fail');
      }
    },
    [code, pushHistory, t],
  );

  useEffect(() => {
    handleRunRef.current = (override?: string) => {
      void handleRun(override);
    };
  }, [handleRun]);

  const handleCreateSnippet = useCallback(async (): Promise<void> => {
    const baseName = t('python.snippet.defaultName', { n: snippets.length + 1 });
    const created = await createPythonSnippet(baseName, code);
    setSnippets((prev) => [created, ...prev]);
    setActiveSnippetId(created.id);
    setSnippetMenuOpen(false);
    setRenameValue(created.name);
    setRenaming(true);
  }, [code, snippets.length, t]);

  const handleSwitchSnippet = useCallback(
    (snippet: PlaygroundSnippet): void => {
      if (activeSnippetId && activeSnippetId !== snippet.id) {
        void updatePythonSnippetCode(activeSnippetId, code);
      }
      setActiveSnippetId(snippet.id);
      setCode(snippet.code);
      setStatus('idle');
      setLines([]);
      setClearedBackup(null);
      setSnippetMenuOpen(false);
    },
    [activeSnippetId, code],
  );

  const handleDeleteSnippet = useCallback(
    async (snippet: PlaygroundSnippet): Promise<void> => {
      await deletePythonSnippet(snippet.id);
      setSnippets((prev) => prev.filter((item) => item.id !== snippet.id));
      if (activeSnippetId === snippet.id) {
        setActiveSnippetId(undefined);
      }
    },
    [activeSnippetId],
  );

  const commitRename = useCallback((): void => {
    setRenaming(false);
    if (!activeSnippetId) return;
    const trimmed = renameValue.trim();
    if (trimmed.length === 0) return;
    void renamePythonSnippet(activeSnippetId, trimmed);
    setSnippets((prev) =>
      prev.map((item) => (item.id === activeSnippetId ? { ...item, name: trimmed } : item)),
    );
  }, [activeSnippetId, renameValue]);

  const restoreFromHistory = useCallback((entry: RunHistoryEntry): void => {
    setCode(entry.code);
    setActiveSnippetId(undefined);
  }, []);

  const running = status === 'loading' || status === 'running';
  const consoleStatus = status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : status;
  const currentTemplate = pythonTemplateById(templateId) ?? defaultPythonTemplate;
  const headerLabel = activeSnippet ? activeSnippet.name : t(currentTemplate.labelKey);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-fg-muted">{t('gallery.choose')}</p>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<FilePlus2 size={13} />}
              onClick={handleNewBlank}
              className="h-9 sm:h-8"
            >
              {t('python.newBlank')}
            </Button>
          </div>
          <TemplatePicker options={templateOptions} onOpen={handleOpenTemplate} icon={Terminal} />
        </motion.div>
      ) : (
        <motion.div key="workspace" {...motionProps} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ArrowLeft size={14} />}
              onClick={backToGallery}
              className="-ml-2 h-11 sm:h-8"
            >
              {t('actions.backToTemplates')}
            </Button>

            <div ref={snippetMenuRef} className="relative flex items-center gap-1.5">
              <Terminal size={12} className="shrink-0 text-accent" aria-hidden />
              {renaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') setRenaming(false);
                  }}
                  aria-label={t('python.snippet.renameAria')}
                  className="h-8 w-40 rounded-md border border-border-strong bg-surface px-2 text-[16px] sm:text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSnippetMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={snippetMenuOpen}
                  className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 h-8 text-[12.5px] text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors"
                >
                  <span className="truncate max-w-[12rem]">{headerLabel}</span>
                  {activeSnippet && (
                    <Badge tone="accent" variant="soft" className="ml-0.5">
                      {t('python.snippet.badge')}
                    </Badge>
                  )}
                  <ChevronDown size={13} className="shrink-0 opacity-70" />
                </button>
              )}
              {activeSnippet && !renaming && (
                <button
                  type="button"
                  onClick={() => {
                    setRenameValue(activeSnippet.name);
                    setRenaming(true);
                  }}
                  aria-label={t('python.snippet.rename')}
                  className="grid size-8 place-items-center rounded-md text-fg-subtle hover:text-fg hover:bg-surface-2/60 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              )}

              {snippetMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[80vw] rounded-xl border border-border-base bg-surface p-1.5 shadow-float"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void handleCreateSnippet();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-fg hover:bg-surface-2/70 transition-colors"
                  >
                    <Plus size={14} className="text-accent" />
                    {t('python.snippet.create')}
                  </button>
                  {snippets.length > 0 && <div className="my-1 border-t border-border-base/70" />}
                  <div className="max-h-64 overflow-y-auto [scrollbar-width:thin]">
                    {snippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        className={cx(
                          'group flex items-center gap-1 rounded-lg px-1 transition-colors',
                          snippet.id === activeSnippetId ? 'bg-accent/10' : 'hover:bg-surface-2/70',
                        )}
                      >
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={snippet.id === activeSnippetId}
                          onClick={() => handleSwitchSnippet(snippet)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2 text-left text-[13px]"
                        >
                          {snippet.id === activeSnippetId ? (
                            <Check size={13} className="shrink-0 text-accent" />
                          ) : (
                            <Save size={13} className="shrink-0 text-fg-subtle" />
                          )}
                          <span className="truncate text-fg">{snippet.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteSnippet(snippet);
                          }}
                          aria-label={t('python.snippet.delete')}
                          className="grid size-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:text-err hover:bg-err/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {snippets.length === 0 && (
                    <p className="px-2.5 py-2 text-[12px] text-fg-subtle">
                      {t('python.snippet.empty')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Surface variant="paper" className="min-w-0 overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
                <span className="eyebrow font-mono">python</span>
                <span className="text-[10.5px] text-fg-subtle">
                  {isCoarsePointer ? t('python.runHintTouch') : 'ctrl + enter'}
                </span>
              </div>
              <LazyCodeEditor
                value={code}
                onChange={(value) => setCode(value ?? '')}
                language="python"
                height={buildEditorHeight(isCoarsePointer, '300px', 'min(45dvh, 360px)')}
                options={buildEditorOptions(isCoarsePointer, 4, editorPrefs)}
                onMount={(editor) => {
                  editor.onKeyDown((event) => {
                    if ((event.ctrlKey || event.metaKey) && event.code === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRunRef.current();
                    }
                  });
                }}
              />
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border-base bg-surface-2/40 px-3 py-2">
                <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle">
                  {t('python.packagesLabel')}
                </span>
                {PYODIDE_PACKAGES.slice(0, 6).map((pkg) => (
                  <span
                    key={pkg}
                    className={cx(
                      'rounded-xs px-1.5 py-0.5 text-[10.5px] font-mono',
                      detectedPackages.includes(pkg)
                        ? 'bg-accent/12 text-accent'
                        : 'bg-surface-2/80 text-fg-subtle',
                    )}
                  >
                    {pkg}
                  </span>
                ))}
                <span className="text-[10.5px] text-fg-subtle">{t('python.packagesMore')}</span>
              </div>
            </Surface>

            <div className="min-w-0">
              <PythonConsole
                lines={lines}
                status={consoleStatus}
                emptyMessage={t('python.consoleEmpty')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button
                variant="danger"
                size="sm"
                leadingIcon={<Square size={13} />}
                onClick={handleStop}
                className="h-11 flex-1 sm:h-8 sm:flex-initial"
              >
                {t('python.stop')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Play size={14} />}
                onClick={() => {
                  void handleRun();
                }}
                className="h-11 flex-1 sm:h-8 sm:flex-initial"
              >
                {t('python.run')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<FilePlus2 size={13} />}
              onClick={handleNewBlank}
              className="h-11 sm:h-8"
            >
              {t('python.newBlank')}
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
            {clearedBackup ? (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Undo2 size={13} />}
                onClick={handleUndoClear}
                className="h-11 sm:h-8 text-accent"
              >
                {t('python.undoClear')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Eraser size={13} />}
                onClick={handleClear}
                className="h-11 sm:h-8"
              >
                {t('actions.clear')}
              </Button>
            )}
          </div>

          {history.length > 0 && (
            <Surface variant="paper" className="overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setHistoryOpen((prev) => !prev)}
                aria-expanded={historyOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-2/50 transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
                  <History size={14} className="text-accent" />
                  {t('python.history.title', { count: history.length })}
                </span>
                <ChevronDown
                  size={15}
                  className={cx(
                    'text-fg-subtle transition-transform duration-fast',
                    historyOpen && 'rotate-180',
                  )}
                />
              </button>
              {historyOpen && (
                <ul className="border-t border-border-base divide-y divide-border-base/60">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]"
                    >
                      <span
                        className={cx(
                          'inline-flex size-5 shrink-0 place-items-center items-center justify-center rounded-md',
                          entry.status === 'pass' && 'bg-ok/15 text-ok',
                          entry.status === 'fail' && 'bg-err/15 text-err',
                          entry.status === 'stopped' && 'bg-warn/15 text-warn',
                        )}
                      >
                        {entry.status === 'pass' ? (
                          <Check size={11} />
                        ) : entry.status === 'stopped' ? (
                          <Square size={10} />
                        ) : (
                          <X size={11} />
                        )}
                      </span>
                      <span className="tabular-nums text-fg-subtle">
                        {new Date(entry.at).toLocaleTimeString()}
                      </span>
                      <span className="tabular-nums text-fg-subtle">{entry.durationMs} ms</span>
                      <span className="min-w-0 flex-1 truncate text-fg-muted font-mono">
                        {entry.outputPreview || t('python.history.noOutput')}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => restoreFromHistory(entry)}
                          className="rounded-md px-2 h-7 text-[11.5px] text-fg-muted hover:text-fg hover:bg-surface-2/70 transition-colors"
                        >
                          {t('python.history.restore')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleRun(entry.code);
                          }}
                          className="rounded-md px-2 h-7 text-[11.5px] text-accent hover:bg-accent/10 transition-colors"
                        >
                          {t('python.history.rerun')}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
