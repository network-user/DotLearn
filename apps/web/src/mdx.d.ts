declare module '*.mdx' {
  import type { ComponentType } from 'react';

  export const frontmatter: Record<string, unknown> | undefined;
  const Component: ComponentType<Record<string, unknown>>;
  export default Component;
}
