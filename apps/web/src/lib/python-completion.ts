import type { EditorProps } from '@monaco-editor/react';

type MonacoApi = Parameters<NonNullable<EditorProps['beforeMount']>>[0];

export const PYTHON_KEYWORDS: readonly string[] = [
  'def',
  'class',
  'if',
  'elif',
  'else',
  'for',
  'while',
  'try',
  'except',
  'finally',
  'with',
  'as',
  'import',
  'from',
  'return',
  'yield',
  'lambda',
  'pass',
  'break',
  'continue',
  'raise',
  'assert',
  'del',
  'global',
  'nonlocal',
  'in',
  'is',
  'and',
  'or',
  'not',
  'True',
  'False',
  'None',
  'async',
  'await',
  'match',
  'case',
];

export const PYTHON_BUILTINS: readonly string[] = [
  'print',
  'len',
  'range',
  'list',
  'dict',
  'set',
  'tuple',
  'str',
  'int',
  'float',
  'bool',
  'type',
  'isinstance',
  'enumerate',
  'zip',
  'map',
  'filter',
  'sorted',
  'reversed',
  'sum',
  'min',
  'max',
  'abs',
  'round',
  'open',
  'input',
  'super',
  'iter',
  'next',
  'any',
  'all',
  'hasattr',
  'getattr',
  'setattr',
  'vars',
  'repr',
  'format',
];

interface PythonSnippet {
  label: string;
  insertText: string;
}

const PYTHON_SNIPPETS: readonly PythonSnippet[] = [
  { label: 'def', insertText: 'def ${1:name}(${2:args}):\n\t${0:pass}' },
  {
    label: 'class',
    insertText: 'class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${0:pass}',
  },
  { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n\t${0:pass}' },
  { label: 'while', insertText: 'while ${1:condition}:\n\t${0:pass}' },
  { label: 'if', insertText: 'if ${1:condition}:\n\t${0:pass}' },
  { label: 'if/else', insertText: 'if ${1:condition}:\n\t${2:pass}\nelse:\n\t${0:pass}' },
  {
    label: 'try',
    insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:pass}',
  },
  { label: 'listcomp', insertText: '[${1:expr} for ${2:item} in ${3:iterable}]' },
];

const registered = new WeakSet<object>();

export const registerPythonCompletion = (monaco: MonacoApi): void => {
  if (registered.has(monaco)) return;
  registered.add(monaco);

  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const keywordItems = PYTHON_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        insertText: keyword,
        sortText: `1_${keyword}`,
        range,
      }));

      const snippetItems = PYTHON_SNIPPETS.map((snippet) => ({
        label: snippet.label,
        kind: CompletionItemKind.Snippet,
        insertText: snippet.insertText,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: `2_${snippet.label}`,
        range,
      }));

      const builtinItems = PYTHON_BUILTINS.map((name) => ({
        label: name,
        kind: CompletionItemKind.Function,
        insertText: name,
        sortText: `3_${name}`,
        range,
      }));

      return { suggestions: [...keywordItems, ...snippetItems, ...builtinItems] };
    },
  });
};
