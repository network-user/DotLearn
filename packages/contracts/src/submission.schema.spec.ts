import { describe, expect, it } from 'vitest';

import { CreateSubmissionInput } from './submission.schema';

const valid = () => ({
  title: 'Valid topic proposal title',
  outline: 'A reasonably detailed outline of the proposed topic content.',
  suggestedRuntime: 'none',
  suggestedDifficulty: 'beginner',
  suggestedLanguages: ['ru'],
  suggestedPrimaryLanguage: 'ru',
  estimatedHours: 2,
  tags: ['python'],
  sources: ['https://example.com/docs'],
});

describe('CreateSubmissionInput', () => {
  it('accepts a valid proposal', () => {
    expect(CreateSubmissionInput.safeParse(valid()).success).toBe(true);
  });

  it('rejects a javascript: scheme source url', () => {
    const result = CreateSubmissionInput.safeParse({
      ...valid(),
      sources: ['javascript:alert(1)'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a data: scheme source url', () => {
    const result = CreateSubmissionInput.safeParse({
      ...valid(),
      sources: ['data:text/html,<script>alert(1)</script>'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-long source url (per-URL cap)', () => {
    const result = CreateSubmissionInput.safeParse({
      ...valid(),
      sources: [`https://example.com/?q=${'a'.repeat(2100)}`],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 20 sources', () => {
    const result = CreateSubmissionInput.safeParse({
      ...valid(),
      sources: Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a primaryLanguage not present in suggestedLanguages', () => {
    const result = CreateSubmissionInput.safeParse({
      ...valid(),
      suggestedLanguages: ['ru'],
      suggestedPrimaryLanguage: 'en',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    const result = CreateSubmissionInput.safeParse({ ...valid(), surprise: true });
    expect(result.success).toBe(false);
  });
});
