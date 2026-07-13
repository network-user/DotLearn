import { describe, expect, it } from 'vitest';

import { InterviewQuestionMeta, InterviewRelatedTopic } from './interview.schema';

const validQuestion = {
  id: 79,
  title: 'Корутина в Python',
  category: 'concurrency',
  categoryLabel: 'Параллелизм и async',
  stage: 'tech',
  stageLabel: 'Tech',
  exerciseCount: 3,
  path: 'concurrency/79.ru.mdx',
};

describe('InterviewQuestionMeta schema', () => {
  it('parses a question without relatedTopics (field is optional)', () => {
    const result = InterviewQuestionMeta.safeParse(validQuestion);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedTopics).toBeUndefined();
    }
  });

  it('parses a question with an optional direction', () => {
    const result = InterviewQuestionMeta.safeParse({
      ...validQuestion,
      direction: 'go',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe('go');
    }
  });

  it('rejects an invalid direction', () => {
    expect(
      InterviewQuestionMeta.safeParse({
        ...validQuestion,
        direction: 'rust',
      }).success,
    ).toBe(false);
  });

  it('parses a question with relatedTopics including an optional conceptId', () => {
    const result = InterviewQuestionMeta.safeParse({
      ...validQuestion,
      relatedTopics: [{ slug: 'celery' }, { slug: 'python-storage-internals', conceptId: 'gil' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedTopics).toHaveLength(2);
    }
  });

  it('parses a question with direction field', () => {
    const result = InterviewQuestionMeta.safeParse({
      ...validQuestion,
      direction: 'python',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid direction', () => {
    expect(
      InterviewQuestionMeta.safeParse({
        ...validQuestion,
        direction: 'rust',
      }).success,
    ).toBe(false);
  });

  it('rejects a relatedTopics entry whose slug is not a slug', () => {
    expect(
      InterviewQuestionMeta.safeParse({
        ...validQuestion,
        relatedTopics: [{ slug: 'Not A Slug' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key inside a relatedTopics entry (strict)', () => {
    expect(
      InterviewQuestionMeta.safeParse({
        ...validQuestion,
        relatedTopics: [{ slug: 'celery', extra: true }],
      }).success,
    ).toBe(false);
  });
});

describe('InterviewRelatedTopic schema', () => {
  it('accepts slug with optional conceptId', () => {
    expect(InterviewRelatedTopic.safeParse({ slug: 'sql-fundamentals' }).success).toBe(true);
    expect(
      InterviewRelatedTopic.safeParse({ slug: 'sql-fundamentals', conceptId: 'joins' }).success,
    ).toBe(true);
  });

  it('rejects an empty conceptId', () => {
    expect(
      InterviewRelatedTopic.safeParse({ slug: 'sql-fundamentals', conceptId: '' }).success,
    ).toBe(false);
  });
});
