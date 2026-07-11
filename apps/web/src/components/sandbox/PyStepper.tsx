import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Loader2, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { getPythonRuntime, prewarmPythonRuntime } from '@/lib/python-runtime';
import { highlightStatic } from '@/lib/shiki';

interface PyStepperProps {
  code: string;
  title?: string;
  /** ms between auto-play steps */
  speed?: number;
}

interface TraceStep {
  line: number;
  event: 'line' | 'return' | 'exception';
  func: string;
  locals: Record<string, string>;
  stdout: string;
  error?: string;
}

const buildTraceSource = (userSourceB64: string): string => `
import sys, base64, json, io

_dotlearn_user_source = base64.b64decode("${userSourceB64}").decode("utf-8")
_dotlearn_trace = []
_dotlearn_max = 500
_dotlearn_out = io.StringIO()
_dotlearn_prev_stdout = sys.stdout

def _dotlearn_tracer(frame, event, arg):
    if len(_dotlearn_trace) >= _dotlearn_max:
        sys.settrace(None)
        return None
    if event not in ("line", "return"):
        return _dotlearn_tracer
    if frame.f_code.co_filename != "<user>":
        return _dotlearn_tracer
    snapshot = {}
    for k, v in list(frame.f_locals.items()):
        if k.startswith("_dotlearn_"):
            continue
        try:
            r = repr(v)
        except Exception:
            r = "<unrepr>"
        if len(r) > 160:
            r = r[:160] + "…"
        snapshot[k] = r
    _dotlearn_trace.append({
        "line": frame.f_lineno,
        "event": event,
        "func": frame.f_code.co_name,
        "locals": snapshot,
        "stdout": _dotlearn_out.getvalue()[:4000],
    })
    return _dotlearn_tracer

_dotlearn_globals = {"__name__": "__main__"}
_dotlearn_code = compile(_dotlearn_user_source, "<user>", "exec")
sys.stdout = _dotlearn_out
sys.settrace(_dotlearn_tracer)
try:
    exec(_dotlearn_code, _dotlearn_globals)
except Exception as _dotlearn_err:
    _dotlearn_trace.append({
        "line": -1,
        "event": "exception",
        "func": "<module>",
        "locals": {},
        "error": repr(_dotlearn_err),
        "stdout": _dotlearn_out.getvalue()[:4000],
    })
finally:
    sys.settrace(None)
    sys.stdout = _dotlearn_prev_stdout
`;

const encodeUtf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const PyStepper = ({ code, title, speed = 700 }: PyStepperProps) => {
  const { t } = useTranslation('viz');
  const trimmed = code.trim();
  const sourceLines = useMemo(() => trimmed.split('\n'), [trimmed]);
  const [lineHtml, setLineHtml] = useState<(string | null)[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'tracing' | 'ready' | 'error'>('idle');
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const codeScrollRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const run = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setErrorMessage(null);
    setTrace([]);
    setIndex(0);
    setPlaying(false);
    try {
      const runtime = getPythonRuntime();
      await runtime.init();
      setStatus('tracing');
      const b64 = encodeUtf8(trimmed);
      const traceSource = buildTraceSource(b64);
      const execution = await runtime.evaluate(traceSource, 'json.dumps(_dotlearn_trace)');
      if (execution.thrown) {
        setStatus('error');
        setErrorMessage(`${execution.thrown.type}: ${execution.thrown.message}`);
        return;
      }
      const raw = execution.result;
      const json = typeof raw === 'string' ? raw : JSON.stringify(raw);
      try {
        const parsed = JSON.parse(json) as TraceStep[];
        setTrace(parsed);
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorMessage(t('pystepper.parseError'));
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [trimmed, t]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (index >= trace.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, trace.length - 1));
    }, speed);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, index, trace.length, speed]);

  useEffect(() => {
    const container = codeScrollRef.current;
    const active = activeLineRef.current;
    if (!container || !active) return;
    const target = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
    container.scrollTop = Math.max(0, target);
  }, [index]);

  // Highlight each source line independently (rather than the whole block)
  // so the existing per-line row structure — line numbers, active-line
  // background — stays untouched; only the <code> content swaps in.
  useEffect(() => {
    let cancelled = false;
    setLineHtml(null);
    void Promise.all(
      sourceLines.map((line) =>
        line.trim().length === 0 ? Promise.resolve(null) : highlightStatic(line, 'python'),
      ),
    ).then((results) => {
      if (!cancelled) setLineHtml(results);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceLines]);

  const step = trace[index];
  const prevStep = index > 0 ? trace[index - 1] : undefined;
  const hasTrace = trace.length > 0;
  const isBusy = status === 'loading' || status === 'tracing';

  const localsEntries = step ? Object.entries(step.locals) : [];

  const anyOutput = useMemo(() => trace.some((s) => s.stdout.length > 0), [trace]);
  const currentOut = step?.stdout ?? '';
  const prevOut = prevStep?.stdout ?? '';
  const splitAt = currentOut.startsWith(prevOut) ? prevOut.length : currentOut.length;
  const oldOut = currentOut.slice(0, splitAt);
  const newOut = currentOut.slice(splitAt);

  const eventLabel =
    step?.event === 'return'
      ? t('pystepper.event.return')
      : step?.event === 'exception'
        ? t('pystepper.event.exception')
        : t('pystepper.event.line');

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!hasTrace) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPlaying(false);
      setIndex((i) => Math.min(trace.length - 1, i + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPlaying(false);
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPlaying(false);
      setIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPlaying(false);
      setIndex(trace.length - 1);
    }
  };

  return (
    <aside
      role="group"
      aria-label={title ?? t('pystepper.title')}
      onKeyDown={handleKeyDown}
      className="not-prose my-5 rounded-lg border border-border-base bg-surface overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/60">
        <span className="eyebrow truncate">{title ?? t('pystepper.title')}</span>
        <button
          type="button"
          onClick={run}
          onPointerEnter={prewarmPythonRuntime}
          onFocus={prewarmPythonRuntime}
          disabled={isBusy}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 sm:h-7 min-h-[var(--tap)] sm:min-h-0 text-[12px] font-medium transition-colors duration-fast shrink-0',
            'bg-accent/12 text-accent hover:bg-accent/20 disabled:opacity-60',
          )}
        >
          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {t('pystepper.run')}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div
          ref={codeScrollRef}
          className="relative font-mono text-[13px] leading-[1.75] py-2 overflow-x-auto bg-code-bg max-h-[420px] overflow-y-auto [scrollbar-width:thin]"
        >
          {sourceLines.map((line, lineIndex) => {
            const lineNo = lineIndex + 1;
            const active = step !== undefined && step.line === lineNo;
            const highlighted = lineHtml?.[lineIndex] ?? null;
            return (
              <div
                key={lineIndex}
                ref={active ? activeLineRef : undefined}
                className={cx(
                  'grid grid-cols-[40px_1fr] gap-2 px-2 transition-colors duration-fast',
                  active && 'bg-accent/14',
                  step?.event === 'exception' && active && 'bg-err/14',
                  step?.event === 'return' && active && 'bg-ok/14',
                )}
              >
                <span className="text-fg-subtle/70 text-right select-none tabular-nums pr-1 border-r border-border-base/60">
                  {active ? <span className="text-accent">▸</span> : lineNo}
                </span>
                {highlighted ? (
                  <pre className="shiki whitespace-pre m-0 p-0 bg-transparent font-mono">
                    <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                  </pre>
                ) : (
                  <code className="whitespace-pre text-fg">{line || ' '}</code>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t md:border-t-0 md:border-l border-border-base bg-surface flex flex-col">
          <div className="px-3 py-2 border-b border-border-base/60 flex items-center justify-between gap-2">
            <span className="eyebrow truncate">{step ? step.func : t('pystepper.frame')}</span>
            {step && (
              <span className="text-[12px] text-fg-muted tabular-nums whitespace-nowrap">
                {eventLabel}
                {step.line >= 0 && ` · ${step.line}`}
              </span>
            )}
          </div>
          <div className="px-3 py-2.5 flex-1 overflow-y-auto max-h-[320px] [scrollbar-width:thin]">
            {status === 'idle' && (
              <p className="text-[13px] text-fg-subtle italic leading-relaxed">
                {t('pystepper.idle')}
              </p>
            )}
            {isBusy && (
              <p className="text-[13px] text-fg-muted flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                {status === 'loading' ? t('pystepper.loading') : t('pystepper.tracing')}
              </p>
            )}
            {status === 'error' && (
              <p className="text-[13px] text-err font-mono whitespace-pre-wrap break-words leading-relaxed">
                {errorMessage}
              </p>
            )}
            {status === 'ready' && step && step.event === 'exception' && (
              <p className="text-[13px] text-err font-mono whitespace-pre-wrap break-words leading-relaxed">
                {step.error}
              </p>
            )}
            {status === 'ready' &&
              step &&
              step.event !== 'exception' &&
              localsEntries.length === 0 && (
                <p className="text-[13px] text-fg-subtle italic">{t('pystepper.noLocals')}</p>
              )}
            {status === 'ready' && step && localsEntries.length > 0 && (
              <ul className="space-y-2">
                {localsEntries.map(([name, value]) => {
                  const changed =
                    index > 0 &&
                    prevStep !== undefined &&
                    (!(name in prevStep.locals) || prevStep.locals[name] !== value);
                  return (
                    <li
                      key={name}
                      className={cx(
                        'rounded-md border-l-2 pl-2.5 pr-1 py-1 transition-colors duration-fast',
                        changed ? 'border-accent bg-accent/[0.07]' : 'border-transparent',
                      )}
                    >
                      <div className="text-[11.5px] font-mono text-accent break-words">{name}</div>
                      <div className="text-[13px] font-mono text-fg leading-relaxed break-words whitespace-pre-wrap">
                        {value}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {hasTrace && (
            <div className="border-t border-border-base/60 px-2 py-2 space-y-1.5">
              <p className="text-center text-[11.5px] text-fg-muted tabular-nums">
                {t('pystepper.counter', {
                  current: Math.min(index + 1, trace.length),
                  total: trace.length,
                })}
              </p>
              <div className="flex items-center justify-center gap-1">
                <ControlButton
                  onClick={() => setIndex(0)}
                  disabled={index === 0}
                  label={t('pystepper.nav.first')}
                  icon={<SkipBack size={16} />}
                />
                <ControlButton
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  label={t('pystepper.nav.prev')}
                  icon={<StepBack size={16} />}
                />
                <ControlButton
                  onClick={() => setPlaying((p) => !p)}
                  label={playing ? t('pystepper.nav.pause') : t('pystepper.nav.play')}
                  icon={playing ? <Pause size={16} /> : <Play size={16} />}
                  primary
                />
                <ControlButton
                  onClick={() => setIndex((i) => Math.min(trace.length - 1, i + 1))}
                  disabled={index >= trace.length - 1}
                  label={t('pystepper.nav.next')}
                  icon={<StepForward size={16} />}
                />
                <ControlButton
                  onClick={() => setIndex(trace.length - 1)}
                  disabled={index >= trace.length - 1}
                  label={t('pystepper.nav.last')}
                  icon={<SkipForward size={16} />}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {status === 'ready' && anyOutput && (
        <section className="border-t border-border-base">
          <div className="px-3 py-1.5 border-b border-border-base/60 bg-surface-2/40">
            <span className="eyebrow">{t('pystepper.output')}</span>
          </div>
          <div className="px-3 py-2.5 bg-code-bg font-mono text-[13px] leading-6 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto [scrollbar-width:thin]">
            {currentOut ? (
              <>
                <span className="text-fg-muted">{oldOut}</span>
                <span className="rounded-sm bg-accent/12 text-fg">{newOut}</span>
              </>
            ) : (
              <span className="text-fg-subtle italic">{t('pystepper.outputEmpty')}</span>
            )}
          </div>
        </section>
      )}
    </aside>
  );
};

interface ControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
}

const ControlButton = ({ onClick, disabled, label, icon, primary }: ControlButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex items-center justify-center rounded-md transition-colors duration-fast',
      'size-11 sm:size-8 min-h-[var(--tap)] min-w-[var(--tap)] sm:min-h-0 sm:min-w-0',
      primary
        ? 'bg-accent text-surface dark:text-canvas hover:bg-accent/85 disabled:opacity-40'
        : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed',
    )}
  >
    {icon}
  </button>
);
