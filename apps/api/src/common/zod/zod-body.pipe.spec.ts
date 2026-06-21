import { BadRequestException } from '@nestjs/common';
import { CreateSubmissionInput, ReviewSubmissionInput } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { ZodBodyPipe } from './zod-body.pipe';

const validCreateBody: CreateSubmissionInput = {
  title: 'Mastering SQL window functions',
  outline: 'A deep dive into partitions, frames and ranking functions in SQL.',
  suggestedRuntime: 'sql.js',
  suggestedDifficulty: 'intermediate',
  suggestedLanguages: ['en'],
  suggestedPrimaryLanguage: 'en',
  estimatedHours: 4,
  tags: ['sql', 'databases'],
  sources: [],
};

describe('ZodBodyPipe', () => {
  it('returns parsed data unchanged for a valid body', () => {
    const pipe = new ZodBodyPipe(CreateSubmissionInput);
    expect(pipe.transform(validCreateBody)).toEqual(validCreateBody);
  });

  it('applies schema defaults to the parsed output', () => {
    const pipe = new ZodBodyPipe(CreateSubmissionInput);
    const { sources: _omitted, ...withoutSources } = validCreateBody;
    const result = pipe.transform(withoutSources) as CreateSubmissionInput;
    expect(result.sources).toEqual([]);
  });

  it('throws BadRequestException for a body that violates the schema', () => {
    const pipe = new ZodBodyPipe(CreateSubmissionInput);
    expect(() => pipe.transform({ ...validCreateBody, title: 'x' })).toThrow(BadRequestException);
  });

  it('rejects unknown keys because the schema is strict', () => {
    const pipe = new ZodBodyPipe(CreateSubmissionInput);
    expect(() => pipe.transform({ ...validCreateBody, unexpected: true })).toThrow(
      BadRequestException,
    );
  });

  it('includes zod issues in the thrown BadRequestException response', () => {
    const pipe = new ZodBodyPipe(ReviewSubmissionInput);
    try {
      pipe.transform({ decision: 'maybe' });
      expect.unreachable('transform should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        issues: unknown[];
      };
      expect(response.message).toBe('Validation failed');
      expect(Array.isArray(response.issues)).toBe(true);
      expect(response.issues.length).toBeGreaterThan(0);
    }
  });

  it('passes a valid review body through unchanged', () => {
    const pipe = new ZodBodyPipe(ReviewSubmissionInput);
    expect(pipe.transform({ decision: 'approve' })).toEqual({ decision: 'approve' });
  });
});
