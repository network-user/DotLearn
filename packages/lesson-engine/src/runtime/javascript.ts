export interface JavascriptExecution {
  result: unknown;
  thrown?: { name: string; message: string };
}

export interface JavascriptRuntime {
  evaluate(source: string, call: string): Promise<JavascriptExecution>;
}

export const inlineJavascriptRuntime: JavascriptRuntime = {
  async evaluate(source, call) {
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
