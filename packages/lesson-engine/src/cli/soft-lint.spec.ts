import { describe, expect, it } from 'vitest';

import {
  analyzeQuizChoiceLengths,
  QUIZ_MAX_CORRECT_TO_AVG_WRONG_RATIO,
  QUIZ_MAX_CORRECT_TO_MAX_WRONG_RATIO,
} from './soft-lint';

describe('analyzeQuizChoiceLengths', () => {
  it('flags a uniquely long correct answer', () => {
    const report = analyzeQuizChoiceLengths(
      [
        {
          id: 'a',
          text: 'Чем плотнее таблица, тем больше коллизий и длиннее проба; запас держит среднее время поиска близким к O(1).',
        },
        { id: 'b', text: 'Это требование стандарта, без практического смысла.' },
        { id: 'c', text: 'Свободные бакеты ускоряют сортировку ключей.' },
        { id: 'd', text: 'Чтобы можно было хранить значения None.' },
      ],
      ['a'],
    );

    expect(report.biased).toBe(true);
    expect(report.uniquelyLongestCorrect).toBe(true);
    expect(report.ratioToMaxWrong).toBeGreaterThan(QUIZ_MAX_CORRECT_TO_MAX_WRONG_RATIO);
  });

  it('accepts balanced choice lengths', () => {
    const report = analyzeQuizChoiceLengths(
      [
        {
          id: 'a',
          text: 'Запас снижает число коллизий и длину проб, держа поиск около O(1).',
        },
        {
          id: 'b',
          text: 'Свободные бакеты нужны, чтобы быстрее сортировать ключи словаря.',
        },
        {
          id: 'c',
          text: 'Это формальное требование стандарта без практического смысла.',
        },
        {
          id: 'd',
          text: 'Запас нужен, чтобы словарь мог хранить значения None.',
        },
      ],
      ['a'],
    );

    expect(report.biased).toBe(false);
    expect(report.ratioToMaxWrong).toBeLessThanOrEqual(QUIZ_MAX_CORRECT_TO_MAX_WRONG_RATIO);
    expect(report.ratioToAvgWrong).toBeLessThanOrEqual(QUIZ_MAX_CORRECT_TO_AVG_WRONG_RATIO);
  });

  it('does not flag when a wrong choice is as long as the correct one', () => {
    const long = 'Подробный ответ одинаковой длины про устройство хеш-таблицы X.';
    const report = analyzeQuizChoiceLengths(
      [
        { id: 'a', text: long },
        { id: 'b', text: long.replace('X', 'Y') },
        { id: 'c', text: 'Короткий неверный.' },
      ],
      ['a'],
    );

    expect(report.maxCorrect).toBe(report.maxWrong);
    expect(report.uniquelyLongestCorrect).toBe(false);
    expect(report.biased).toBe(false);
  });
});

