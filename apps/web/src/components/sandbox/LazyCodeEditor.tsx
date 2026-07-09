import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import type { EditorProps, OnMount } from '@monaco-editor/react';

import { Skeleton } from '@/components/ui/Skeleton';
import { registerPythonCompletion } from '@/lib/python-completion';
import { clearSqlSchema, registerSqlCompletion, setSqlSchema } from '@/lib/sql-completion';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const PAPER_THEME = 'dotlearn-paper';
const INK_THEME = 'dotlearn-ink';

const isDarkActive = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

const useResolvedDark = (): boolean => {
  const [dark, setDark] = useState(isDarkActive);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkActive()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
};

type MonacoApi = Parameters<NonNullable<EditorProps['beforeMount']>>[0];

const defineEditorThemes = (monaco: MonacoApi): void => {
  monaco.editor.defineTheme(PAPER_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '92887a', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'bf3c22' },
      { token: 'string', foreground: '2d6a40' },
      { token: 'number', foreground: 'a97520' },
      { token: 'type', foreground: '344f6e' },
    ],
    colors: {
      'editor.background': '#f6f2ea',
      'editor.foreground': '#231e19',
      'editor.lineHighlightBackground': '#eee8dd',
      'editorLineNumber.foreground': '#b3a995',
      'editorCursor.foreground': '#bf3c22',
      'editor.selectionBackground': '#bf3c2233',
    },
  });
  monaco.editor.defineTheme(INK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a8072', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e66546' },
      { token: 'string', foreground: '7ab28a' },
      { token: 'number', foreground: 'd19f4d' },
      { token: 'type', foreground: '7d9cbe' },
    ],
    colors: {
      'editor.background': '#1e1914',
      'editor.foreground': '#ebe4d9',
      'editor.lineHighlightBackground': '#29231c',
      'editorLineNumber.foreground': '#6b6051',
      'editorCursor.foreground': '#e66546',
      'editor.selectionBackground': '#e6654633',
    },
  });
};

interface LazyCodeEditorProps extends EditorProps {
  height: string;
  sqlSchema?: string;
}

type EditorInstance = Parameters<OnMount>[0];

export const LazyCodeEditor = ({
  height,
  beforeMount,
  onMount,
  sqlSchema,
  ...props
}: LazyCodeEditorProps) => {
  const dark = useResolvedDark();
  const editorRef = useRef<EditorInstance | null>(null);
  const isSql = props.language === 'sql';

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    if (isSql && sqlSchema) {
      setSqlSchema(model, sqlSchema);
    } else {
      clearSqlSchema(model);
    }
  }, [isSql, sqlSchema]);

  return (
    <Suspense fallback={<Skeleton rounded="sm" className="w-full" style={{ height }} />}>
      <MonacoEditor
        height={height}
        theme={dark ? INK_THEME : PAPER_THEME}
        beforeMount={(monaco) => {
          defineEditorThemes(monaco);
          if (props.language === 'sql') {
            registerSqlCompletion(monaco);
          }
          if (props.language === 'python') {
            registerPythonCompletion(monaco);
          }
          beforeMount?.(monaco);
        }}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          const model = editor.getModel();
          if (model && isSql && sqlSchema) {
            setSqlSchema(model, sqlSchema);
          }
          onMount?.(editor, monaco);
        }}
        {...props}
      />
    </Suspense>
  );
};
