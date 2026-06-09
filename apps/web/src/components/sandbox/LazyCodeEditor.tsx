import { Suspense, lazy } from 'react';

import type { EditorProps } from '@monaco-editor/react';

import { Skeleton } from '@/components/ui/Skeleton';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface LazyCodeEditorProps extends EditorProps {
  height: string;
}

export const LazyCodeEditor = ({ height, ...props }: LazyCodeEditorProps) => (
  <Suspense fallback={<Skeleton rounded="sm" className="w-full" style={{ height }} />}>
    <MonacoEditor height={height} {...props} />
  </Suspense>
);
