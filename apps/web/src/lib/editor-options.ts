import type { EditorProps } from '@monaco-editor/react';

type EditorOptions = NonNullable<EditorProps['options']>;

const touchOverrides: EditorOptions = {
  fontSize: 16,
  lineNumbers: 'off',
  folding: false,
  glyphMargin: false,
  lineDecorationsWidth: 8,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: 'off',
  parameterHints: { enabled: false },
  scrollbar: { alwaysConsumeMouseWheel: false },
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
};

export const buildEditorOptions = (isCoarsePointer: boolean, tabSize: number): EditorOptions => {
  const base: EditorOptions = {
    fontSize: 13,
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    tabSize,
    padding: { top: 12, bottom: 12 },
  };
  return isCoarsePointer ? { ...base, ...touchOverrides } : base;
};

export const buildEditorHeight = (
  isCoarsePointer: boolean,
  desktopHeight: string,
  touchHeight: string,
): string => (isCoarsePointer ? touchHeight : desktopHeight);
