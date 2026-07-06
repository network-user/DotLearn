import { useEffect, useRef, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';
import { Highlighter, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { HighlightColorPicker } from '@/components/HighlightColorPicker';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { cx } from '@/components/ui/cx';
import {
  HIGHLIGHT_MARK_ATTRIBUTE,
  applyHighlightMarks,
  captureSelectionContext,
  pruneHighlightMarks,
} from '@/lib/highlight-anchor';
import { highlightMarkClass } from '@/lib/highlight-colors';
import {
  addHighlight,
  removeHighlight,
  setHighlightColor,
  setHighlightNote,
  type HighlightColor,
} from '@/lib/progress-db';
import { useConceptHighlights } from '@/lib/use-learning';

const HINT_SEEN_KEY = 'dotlearn:highlight-hint-seen';
const HINT_SEEN_EVENT = 'dotlearn:highlight-hint-seen';

const readHintSeen = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const markHintSeen = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HINT_SEEN_KEY, '1');
  } catch {
    return;
  } finally {
    window.dispatchEvent(new Event(HINT_SEEN_EVENT));
  }
};

export const TheoryHighlightHint = () => {
  const { t } = useTranslation('topic');
  const [seen, setSeen] = useState(readHintSeen);

  useEffect(() => {
    const onSeen = (): void => setSeen(true);
    window.addEventListener(HINT_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(HINT_SEEN_EVENT, onSeen);
  }, []);

  if (seen) return null;

  return (
    <Surface variant="inset" rule="left" className="border-l-accent/40">
      <div className="flex items-center gap-3 py-2.5 pl-4 pr-2">
        <Highlighter size={16} aria-hidden className="shrink-0 text-accent" />
        <p className="flex-1 text-[13px] leading-relaxed text-fg-muted">
          {t('highlight.hint.body')}
        </p>
        <button
          type="button"
          aria-label={t('highlight.hint.dismiss')}
          title={t('highlight.hint.dismiss')}
          onClick={markHintSeen}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:text-fg sm:size-8"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </Surface>
  );
};

interface TheoryHighlighterProps {
  slug: string;
  conceptId: string;
}

interface ToolbarState {
  x: number;
  y: number;
  text: string;
  prefix: string;
  suffix: string;
}

interface EditorState {
  id: string;
  x: number;
  y: number;
}

const EDITOR_ESTIMATED_HEIGHT = 250;

const editorPosition = (rect: DOMRect): { x: number; y: number } => {
  const width = Math.min(300, window.innerWidth * 0.92);
  const x = Math.min(
    Math.max(rect.left + rect.width / 2, width / 2 + 8),
    window.innerWidth - width / 2 - 8,
  );
  const below = rect.bottom + 10;
  const y =
    below + EDITOR_ESTIMATED_HEIGHT > window.innerHeight - 12
      ? Math.max(12, rect.top - EDITOR_ESTIMATED_HEIGHT - 10)
      : below;
  return { x, y };
};

export const TheoryHighlighter = ({ slug, conceptId }: TheoryHighlighterProps) => {
  const { t } = useTranslation('topic');
  const navigate = useNavigate();
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const highlights = useConceptHighlights(slug, conceptId);

  useEffect(() => {
    setToolbar(null);
    setEditor(null);
    const container = document.querySelector('[data-toc-root]');
    if (!container) return;

    const compute = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      const text = selection.toString().trim();
      if (text.length < 3) {
        setToolbar(null);
        return;
      }
      const { anchorNode, focusNode } = selection;
      if (
        !anchorNode ||
        !focusNode ||
        !container.contains(anchorNode) ||
        !container.contains(focusNode)
      ) {
        setToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbar(null);
        return;
      }
      const context = captureSelectionContext(container, range);
      const x = Math.min(Math.max(rect.left + rect.width / 2, 84), window.innerWidth - 84);
      setToolbar({ x, y: rect.top, text, prefix: context.prefix, suffix: context.suffix });
    };

    const onPointerUp = (event: Event): void => {
      const target = event.target as Node | null;
      if (barRef.current && target && barRef.current.contains(target)) return;
      if (editorRef.current && target && editorRef.current.contains(target)) return;
      window.setTimeout(compute, 0);
    };
    const onSelectionChange = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setToolbar(null);
    };
    const onScroll = (): void => setToolbar(null);

    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchend', onPointerUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll);
    };
  }, [conceptId]);

  useEffect(() => {
    const container = document.querySelector('[data-toc-root]');
    if (!container) return;
    let disposed = false;
    let frame: number | null = null;
    let selfMutation = false;

    const apply = (): void => {
      frame = null;
      if (disposed) return;
      selfMutation = true;
      pruneHighlightMarks(container, new Set(highlights.map((record) => record.id)));
      applyHighlightMarks(
        container,
        highlights.map((record) => ({
          id: record.id,
          text: record.text,
          className: highlightMarkClass(record.color),
          prefix: record.prefix,
          suffix: record.suffix,
        })),
      );
      window.setTimeout(() => {
        selfMutation = false;
      }, 0);
    };

    const schedule = (): void => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(() => {
      if (selfMutation) return;
      schedule();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      disposed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      pruneHighlightMarks(container, new Set());
    };
  }, [highlights, conceptId]);

  useEffect(() => {
    const container = document.querySelector('[data-toc-root]');
    if (!container) return;
    const onClick = (event: Event): void => {
      const target = event.target as HTMLElement | null;
      const mark = target?.closest?.(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}]`);
      if (!mark || !container.contains(mark)) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const id = mark.getAttribute(HIGHLIGHT_MARK_ATTRIBUTE);
      if (!id) return;
      const { x, y } = editorPosition(mark.getBoundingClientRect());
      setToolbar(null);
      setEditor({ id, x, y });
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [conceptId]);

  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setEditor(null);
    };
    const onPointerDown = (event: Event): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editorRef.current && editorRef.current.contains(target)) return;
      if ((target as HTMLElement).closest?.(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}]`)) return;
      setEditor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [editor]);

  const save = (color: HighlightColor): void => {
    if (!toolbar) return;
    markHintSeen();
    void addHighlight({
      topicSlug: slug,
      conceptId,
      text: toolbar.text,
      color,
      prefix: toolbar.prefix,
      suffix: toolbar.suffix,
    });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    toast.success(t('highlight.saved'), {
      action: {
        label: t('highlight.openLibrary'),
        onClick: () => {
          void navigate({ to: '/library' });
        },
      },
    });
  };

  const editingRecord = editor ? highlights.find((record) => record.id === editor.id) : undefined;

  return (
    <>
      {toolbar ? (
        <div
          ref={barRef}
          className="fixed z-[var(--z-tooltip)] -translate-x-1/2 -translate-y-full"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-border-base glass-strong shadow-float px-2 py-1.5">
            <HighlightColorPicker size="sm" onSelect={save} />
          </div>
        </div>
      ) : null}
      {editor && editingRecord ? (
        <HighlightEditorPopover
          key={editor.id}
          popoverRef={editorRef}
          x={editor.x}
          y={editor.y}
          color={editingRecord.color}
          note={editingRecord.note ?? ''}
          onColorChange={(color) => void setHighlightColor(editor.id, color)}
          onSaveNote={(note) => {
            void setHighlightNote(editor.id, note);
            setEditor(null);
            toast.success(t('highlight.note.saved'));
          }}
          onDelete={() => {
            void removeHighlight(editor.id);
            setEditor(null);
            toast.success(t('highlight.deleted'));
          }}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
};

interface HighlightEditorPopoverProps {
  popoverRef: React.RefObject<HTMLDivElement>;
  x: number;
  y: number;
  color: HighlightColor;
  note: string;
  onColorChange: (color: HighlightColor) => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const HighlightEditorPopover = ({
  popoverRef,
  x,
  y,
  color,
  note,
  onColorChange,
  onSaveNote,
  onDelete,
  onClose,
}: HighlightEditorPopoverProps) => {
  const { t } = useTranslation('topic');
  const [noteValue, setNoteValue] = useState(note);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t('highlight.editorTitle')}
      className="fixed z-[var(--z-tooltip)] w-[min(300px,92vw)] -translate-x-1/2"
      style={{ left: x, top: y }}
    >
      <div className="rounded-xl border border-border-base glass-strong shadow-float p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow text-[10px]">{t('highlight.editorTitle')}</span>
          <button
            type="button"
            aria-label={t('highlight.close')}
            title={t('highlight.close')}
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-fg-subtle transition-colors hover:text-fg"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        <HighlightColorPicker value={color} onSelect={onColorChange} />
        <textarea
          value={noteValue}
          onChange={(event) => setNoteValue(event.target.value)}
          placeholder={t('highlight.note.placeholder')}
          aria-label={t('highlight.note.label')}
          rows={3}
          className="form-input w-full resize-y min-h-[72px]"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={t('highlight.delete')}
            title={t('highlight.delete')}
            onClick={onDelete}
            className={cx(
              'grid size-11 place-items-center rounded-lg border border-border-base text-fg-muted transition-colors hover:text-err sm:size-9',
            )}
          >
            <Trash2 size={15} aria-hidden />
          </button>
          <Button variant="primary" size="sm" onClick={() => onSaveNote(noteValue)}>
            {t('highlight.note.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
