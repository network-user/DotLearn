import type { EditorProps } from '@monaco-editor/react';

import type { EditorSettings } from './settings';

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

const editorPrefsOverrides = (
  prefs: EditorSettings | undefined,
  languageTabSize: number,
): EditorOptions => {
  if (!prefs) return {};
  return {
    fontSize: prefs.fontSize,
    tabSize: prefs.tabSize === 'language-default' ? languageTabSize : prefs.tabSize,
    wordWrap: prefs.wordWrap ? 'on' : 'off',
    lineNumbers: prefs.lineNumbers ? 'on' : 'off',
    quickSuggestions: prefs.autocomplete,
    suggestOnTriggerCharacters: prefs.autocomplete,
    ...(prefs.autocomplete ? {} : { acceptSuggestionOnEnter: 'off' as const }),
  };
};

export const buildEditorOptions = (
  isCoarsePointer: boolean,
  tabSize: number,
  prefs?: EditorSettings,
): EditorOptions => {
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
  const profile = isCoarsePointer ? { ...base, ...touchOverrides } : base;
  return { ...profile, ...editorPrefsOverrides(prefs, tabSize) };
};

export const buildEditorHeight = (
  isCoarsePointer: boolean,
  desktopHeight: string,
  touchHeight: string,
): string => (isCoarsePointer ? touchHeight : desktopHeight);
