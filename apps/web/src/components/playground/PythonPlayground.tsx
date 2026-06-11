import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Eraser, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { PythonConsole, type ConsoleLine } from '@/components/sandbox/PythonConsole';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { coarsePointerQuery, useMediaQuery } from '@/hooks/useMediaQuery';
import { buildEditorHeight, buildEditorOptions } from '@/lib/editor-options';
import { savePythonState, type PythonPlaygroundState } from '@/lib/playground';
import {
  defaultPythonTemplate,
  pythonTemplateById,
  pythonTemplates,
  type PythonTemplate,
} from '@/lib/sandbox-templates/python';
import { getPythonRuntime } from '@/lib/python-runtime';

import { TemplatePicker, type TemplateOption } from './TemplatePicker';

interface PythonPlaygroundProps {
  initialState: PythonPlaygroundState;
}

type RunStatus = 'idle' | 'loading' | 'running' | 'pass' | 'fail';

const splitStdout = (text: string, prefix: string): ConsoleLine[] =>
  text
    .split('\n')
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ''))
    .map((line, index) => ({ id: `${prefix}-${index}`, tone: 'stdout' as const, text: line }));

export const PythonPlayground = ({ initialState }: PythonPlaygroundProps) => {
  const { t } = useTranslation('sandbox');
  const isCoarsePointer = useMediaQuery(coarsePointerQuery);
  const [templateId, setTemplateId] = useState(initialState.templateId);
  const [code, setCode] = useState(initialState.code);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const session = useRef(0);

  useEffect(() => {
    void savePythonState({ templateId, code });
  }, [templateId, code]);

  const templateOptions: TemplateOption[] = useMemo(
    () =>
      pythonTemplates.map((template) => ({
        id: template.id,
        label: t(template.labelKey),
        description: t(template.descriptionKey),
      })),
    [t],
  );

  const applyTemplate = useCallback((template: PythonTemplate): void => {
    setTemplateId(template.id);
    setCode(template.code);
    setStatus('idle');
    setLines([]);
  }, []);

  const handleSelectTemplate = useCallback(
    (id: string): void => {
      applyTemplate(pythonTemplateById(id) ?? defaultPythonTemplate);
    },
    [applyTemplate],
  );

  const handleReset = useCallback((): void => {
    applyTemplate(pythonTemplateById(templateId) ?? defaultPythonTemplate);
  }, [applyTemplate, templateId]);

  const handleClear = useCallback((): void => {
    setCode('');
    setStatus('idle');
    setLines([]);
  }, []);

  const handleRun = useCallback(async (): Promise<void> => {
    const sid = (session.current += 1);
    setStatus('loading');
    setLines([{ id: `s${sid}-load`, tone: 'system', text: t('python.consoleLoad') }]);
    const startedAt = performance.now();
    try {
      const runtime = getPythonRuntime();
      await runtime.init();
      setStatus('running');
      const execution = await runtime.evaluate(code, 'None');
      const durationMs = Math.round(performance.now() - startedAt);
      const next: ConsoleLine[] = [];
      const stdout = execution.stdout ?? '';
      if (stdout) {
        next.push(...splitStdout(stdout, `s${sid}-out`));
      }
      if (execution.thrown) {
        next.push({
          id: `s${sid}-err`,
          tone: 'fail',
          text: `${execution.thrown.type}: ${execution.thrown.message}`,
        });
        next.push({
          id: `s${sid}-meta`,
          tone: 'meta',
          text: t('python.consoleFailed', { ms: durationMs }),
        });
        setLines((prev) => [...prev, ...next]);
        setStatus('fail');
        return;
      }
      if (next.length === 0) {
        next.push({ id: `s${sid}-empty`, tone: 'system', text: t('python.consoleNoOutput') });
      }
      next.push({
        id: `s${sid}-done`,
        tone: 'meta',
        text: t('python.consoleDone', { ms: durationMs }),
      });
      setLines((prev) => [...prev, ...next]);
      setStatus('pass');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLines((prev) => [
        ...prev,
        { id: `s${sid}-runtime`, tone: 'fail', text: `[runtime] ${message}` },
      ]);
      setStatus('fail');
    }
  }, [code, t]);

  const running = status === 'loading' || status === 'running';
  const consoleStatus = status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : status;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="eyebrow text-fg-subtle">{t('templates.heading')}</h2>
        <TemplatePicker
          options={templateOptions}
          selectedId={templateId}
          onSelect={handleSelectTemplate}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Surface variant="paper" className="min-w-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border-base bg-surface-2/60 px-3 py-2">
            <span className="eyebrow font-mono">python</span>
            {!isCoarsePointer && <span className="text-[10.5px] text-fg-subtle">ctrl + enter</span>}
          </div>
          <LazyCodeEditor
            value={code}
            onChange={(value) => setCode(value ?? '')}
            language="python"
            height={buildEditorHeight(isCoarsePointer, '300px', 'min(45dvh, 360px)')}
            options={buildEditorOptions(isCoarsePointer, 4)}
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

        <div className="min-w-0">
          <PythonConsole
            lines={lines}
            status={consoleStatus}
            emptyMessage={t('python.consoleEmpty')}
          />
        </div>
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
          {status === 'loading'
            ? t('python.loading')
            : status === 'running'
              ? t('python.running')
              : t('python.run')}
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
      </div>
    </div>
  );
};
