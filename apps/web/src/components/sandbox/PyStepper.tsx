import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Loader2, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { getPythonRuntime } from '@/lib/python-runtime';

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
  error?: string;
}

const buildTraceSource = (userSourceB64: string): string => `
import sys, base64, json

_dotlearn_user_source = base64.b64decode("${userSourceB64}").decode("utf-8")
_dotlearn_trace = []
_dotlearn_max = 500

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
    })
    return _dotlearn_tracer

_dotlearn_globals = {"__name__": "__main__"}
_dotlearn_code = compile(_dotlearn_user_source, "<user>", "exec")
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
    })
finally:
    sys.settrace(None)
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
  const trimmed = code.trim();
  const sourceLines = useMemo(() => trimmed.split('\n'), [trimmed]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'tracing' | 'ready' | 'error'>('idle');
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

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
        setErrorMessage('Could not parse trace output.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [trimmed]);

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

  const step = trace[index];
  const hasTrace = trace.length > 0;

  return (
    <aside className="not-prose my-5 rounded-lg border border-border-base bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2/60">
        <span className="eyebrow">{title ?? 'Python stepper'}</span>
        <div className="flex items-center gap-1">
          {hasTrace && (
            <span className="text-[11px] text-fg-subtle tabular-nums mr-1">
              {Math.min(index + 1, trace.length)} / {trace.length}
            </span>
          )}
          <button
            type="button"
            onClick={run}
            disabled={status === 'loading' || status === 'tracing'}
            className={cx(
              'inline-flex items-center gap-1 rounded-md px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              'bg-accent/12 text-accent hover:bg-accent/20 disabled:opacity-60',
            )}
          >
            {status === 'loading' || status === 'tracing' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            trace
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <pre className="font-mono text-[12.5px] leading-[1.7] py-2 overflow-x-auto bg-code-bg m-0 max-h-[420px] overflow-y-auto">
          {sourceLines.map((line, lineIndex) => {
            const lineNo = lineIndex + 1;
            const active = step && step.line === lineNo;
            return (
              <div
                key={lineIndex}
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
                <code className="whitespace-pre text-fg">{line || ' '}</code>
              </div>
            );
          })}
        </pre>

        <div className="border-t md:border-t-0 md:border-l border-border-base bg-surface flex flex-col">
          <div className="px-3 py-2 border-b border-border-base/60 flex items-center justify-between gap-2">
            <span className="eyebrow">{step ? step.func : 'frame'}</span>
            {step && (
              <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle">
                {step.event}
                {step.line >= 0 && ` · line ${step.line}`}
              </span>
            )}
          </div>
          <div className="px-3 py-2 flex-1 overflow-y-auto max-h-[320px]">
            {status === 'idle' && (
              <p className="text-[12.5px] text-fg-subtle italic">
                Run trace to step through execution.
              </p>
            )}
            {(status === 'loading' || status === 'tracing') && (
              <p className="text-[12.5px] text-fg-muted flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {status === 'loading' ? 'loading pyodide…' : 'tracing…'}
              </p>
            )}
            {status === 'error' && (
              <p className="text-[12.5px] text-err font-mono whitespace-pre-wrap">{errorMessage}</p>
            )}
            {status === 'ready' && step && step.event === 'exception' && (
              <p className="text-[12.5px] text-err font-mono whitespace-pre-wrap">{step.error}</p>
            )}
            {status === 'ready' && step && Object.keys(step.locals).length === 0 && (
              <p className="text-[12.5px] text-fg-subtle italic">No locals.</p>
            )}
            {status === 'ready' && step && Object.keys(step.locals).length > 0 && (
              <ul className="space-y-1 text-[12px] font-mono">
                {Object.entries(step.locals).map(([name, value]) => (
                  <li key={name} className="grid grid-cols-[max-content_1fr] gap-2 items-baseline">
                    <span className="text-accent">{name}</span>
                    <span className="text-fg break-all">{value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hasTrace && (
            <div className="border-t border-border-base/60 px-2 py-2 flex items-center justify-center gap-1">
              <ControlButton
                onClick={() => setIndex(0)}
                disabled={index === 0}
                label="first"
                icon={<SkipBack size={12} />}
              />
              <ControlButton
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                label="prev"
                icon={<StepBack size={12} />}
              />
              <ControlButton
                onClick={() => setPlaying((p) => !p)}
                label={playing ? 'pause' : 'play'}
                icon={playing ? <Pause size={12} /> : <Play size={12} />}
                primary
              />
              <ControlButton
                onClick={() => setIndex((i) => Math.min(trace.length - 1, i + 1))}
                disabled={index >= trace.length - 1}
                label="next"
                icon={<StepForward size={12} />}
              />
              <ControlButton
                onClick={() => setIndex(trace.length - 1)}
                disabled={index >= trace.length - 1}
                label="last"
                icon={<SkipForward size={12} />}
              />
            </div>
          )}
        </div>
      </div>
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
    className={cx(
      'inline-flex items-center justify-center size-7 rounded-md transition-colors duration-fast',
      primary
        ? 'bg-accent text-surface dark:text-canvas hover:bg-accent/85 disabled:opacity-40'
        : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed',
    )}
  >
    {icon}
  </button>
);
