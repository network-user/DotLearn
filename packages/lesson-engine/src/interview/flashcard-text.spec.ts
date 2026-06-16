import { describe, expect, it } from 'vitest';

import {
  cleanInterviewAnswer,
  extractInterviewAnswer,
  stripFrontmatter,
} from './flashcard-text';

const SAMPLE = `---
id: 1345
title: "Test question"
---

# Test question

## Суть

Short intro.

## Что ответить на собесе

Декоратор - вызываемый объект.

- \`__call__\` исполняется при каждом вызове.
- Без \`__call__\` будет \`TypeError\`.

## Как это работает

More details.

<PyDemo code={\`print("x")\`} />
`;

describe('stripFrontmatter', () => {
  it('removes yaml frontmatter', () => {
    const body = stripFrontmatter(SAMPLE);
    expect(body).toContain('# Test question');
    expect(body).not.toContain('id: 1345');
  });
});

describe('cleanInterviewAnswer', () => {
  it('strips bullets, code fences, and jsx', () => {
    const input = `
- First point with \`code\`
- Second point

\`\`\`python
ignored()
\`\`\`
`;
    expect(cleanInterviewAnswer(input)).toBe('First point with code Second point');
  });
});

describe('extractInterviewAnswer', () => {
  it('extracts the Russian interview answer section', () => {
    const answer = extractInterviewAnswer(SAMPLE);
    expect(answer).toContain('Декоратор');
    expect(answer).toContain('__call__');
    expect(answer).not.toContain('Как это работает');
    expect(answer).not.toContain('PyDemo');
  });

  it('extracts the English interview answer section', () => {
    const en = SAMPLE.replace('## Что ответить на собесе', '## How to answer in an interview')
      .replace('Декоратор - вызываемый объект.', 'A decorator is a callable object.');
    expect(extractInterviewAnswer(en)).toContain('A decorator is a callable object.');
  });

  it('returns undefined when the section is missing', () => {
    expect(extractInterviewAnswer('# Title\n\n## Суть\n\nOnly intro.')).toBeUndefined();
  });

  it('returns undefined when the section is too short', () => {
    expect(
      extractInterviewAnswer('# Title\n\n## Что ответить на собесе\n\nOK'),
    ).toBeUndefined();
  });
});
