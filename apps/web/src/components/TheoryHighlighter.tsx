import { useEffect, useRef, useState } from 'react';

import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { HighlightColorPicker } from '@/components/HighlightColorPicker';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import {
  HIGHLIGHT_MARK_ATTRIBUTE,
  applyHighlightMarks,
  pruneHighlightMarks,
} from '@/lib/highlight-anchor';
import { highlightMarkClass } from '@/lib/highlight-colors';
import {
  removeHighlight,
  setHighlightColor,
  setHighlightNote,
  type HighlightColor,
} from '@/lib/progress-db';
import { useConceptHighlights } from '@/lib/use-learning';

interface TheoryHighlighterProps {
  slug: string;
  conceptId: string;
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const highlights = useConceptHighlights(slug, conceptId);

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

  const editingRecord = editor ? highlights.find((record) => record.id === editor.id) : undefined;

  return (
    <>
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
