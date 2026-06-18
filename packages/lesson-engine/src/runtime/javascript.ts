export interface JavascriptExecution {
  result: unknown;
  thrown?: { name: string; message: string };
}

export interface JavascriptRuntime {
  evaluate(source: string, call: string): Promise<JavascriptExecution>;
}

const isBrowserMainThread = (): boolean =>
  typeof window !== 'undefined' &&
  typeof (window as { document?: unknown }).document !== 'undefined';

export const inlineJavascriptRuntime: JavascriptRuntime = {
  async evaluate(source, call) {
    if (isBrowserMainThread()) {
      throw new Error(
        'inlineJavascriptRuntime evaluates untrusted code with new Function and must never run on a browser main thread (it would expose the DOM, IndexedDB credentials, and bypass worker isolation). Run JavaScript exercises inside a dedicated Web Worker instead.',
      );
    }
    try {
      const factory = new Function(`${source}\n;return (${call});`);
      const result = factory();
      return { result };
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      const message = error instanceof Error ? error.message : String(error);
      return { result: undefined, thrown: { name, message } };
    }
  },
};
