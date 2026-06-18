import { compile } from '@mdx-js/mdx';

export interface MdxCompileResult {
  ok: boolean;
  reason?: string;
  line?: number;
  column?: number;
}

interface VFileMessage {
  reason?: string;
  message?: string;
  line?: number | null;
  column?: number | null;
}

export const compileTheoryBody = async (body: string): Promise<MdxCompileResult> => {
  try {
    await compile(body, { jsx: true });
    return { ok: true };
  } catch (error) {
    const message = error as VFileMessage;
    const reason =
      typeof message.reason === 'string'
        ? message.reason
        : error instanceof Error
          ? (error.message.split('\n')[0] ?? error.message)
          : String(error);
    const result: MdxCompileResult = { ok: false, reason };
    if (typeof message.line === 'number') {
      result.line = message.line;
    }
    if (typeof message.column === 'number') {
      result.column = message.column;
    }
    return result;
  }
};
