import rawOutputs from '@/generated/demo-outputs.json';

/**
 * Stable hash of a theory code block, used to look up its pre-computed output.
 *
 * MUST stay byte-identical to the hashing in the precompute CLI
 * (packages/lesson-engine/src/cli/precompute-demo-outputs.ts); if the two ever
 * diverge, runtime lookups silently miss and no "показать вывод" button appears.
 *
 * Canonicalization: normalize CRLF -> LF, strip trailing whitespace (a trailing
 * newline is common in rendered <pre> textContent). Hash: FNV-1a, 32-bit, hex.
 */
export function hashDemoCode(code: string): string {
  const canon = code.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i += 1) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const outputs = rawOutputs as Record<string, string>;

/**
 * Pre-computed stdout for a code block, or undefined when none was prepared
 * (block errored, produced no output, was non-deterministic, or isn't runnable
 * in the offline pyodide sandbox). A demonstration with no entry stays static.
 */
export function demoOutputForCode(code: string): string | undefined {
  if (!code) return undefined;
  const value = outputs[hashDemoCode(code)];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
