import type {
  CreateSubmissionInput,
  Submission,
  SubmissionPublic,
  SubmissionSuggestion,
} from '@dotlearn/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchService } from '../search/search.service';
import { SubmissionsController } from './submissions.controller';
import type { SubmissionsService } from './submissions.service';

const validBody: CreateSubmissionInput = {
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

const createdSubmission: Submission = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'pending',
  source: 'in-app',
  createdAt: '2026-01-01T00:00:00.000Z',
  payload: validBody,
};

const publicSubmission: SubmissionPublic = {
  id: createdSubmission.id,
  status: 'pending',
  source: 'in-app',
  createdAt: createdSubmission.createdAt,
  payload: {
    title: validBody.title,
    outline: validBody.outline,
    suggestedRuntime: validBody.suggestedRuntime,
    suggestedDifficulty: validBody.suggestedDifficulty,
    suggestedLanguages: validBody.suggestedLanguages,
    suggestedPrimaryLanguage: validBody.suggestedPrimaryLanguage,
    estimatedHours: validBody.estimatedHours,
    tags: validBody.tags,
    sources: validBody.sources ?? [],
  },
};

interface SubmissionsServiceMock {
  create: ReturnType<typeof vi.fn>;
  listPublic: ReturnType<typeof vi.fn>;
  findPublicByIds: ReturnType<typeof vi.fn>;
}

interface SearchServiceMock {
  search: ReturnType<typeof vi.fn>;
  suggest: ReturnType<typeof vi.fn>;
}

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let submissions: SubmissionsServiceMock;
  let search: SearchServiceMock;

  beforeEach(() => {
    submissions = {
      create: vi.fn(),
      listPublic: vi.fn(),
      findPublicByIds: vi.fn(),
    };
    search = {
      search: vi.fn(),
      suggest: vi.fn(),
    };
    controller = new SubmissionsController(
      submissions as unknown as SubmissionsService,
      search as unknown as SearchService,
    );
  });

  describe('create', () => {
    it('delegates to the service with the in-app source and returns the result', async () => {
      submissions.create.mockResolvedValue(createdSubmission);
      const result = await controller.create(validBody);
      expect(submissions.create).toHaveBeenCalledWith(validBody, 'in-app');
      expect(result).toBe(createdSubmission);
    });
  });

  describe('list', () => {
    it('parses the status and clamps pagination before delegating', async () => {
      submissions.listPublic.mockResolvedValue([publicSubmission]);
      const result = await controller.list('approved', '5', '10');
      expect(submissions.listPublic).toHaveBeenCalledWith('approved', {
        limit: 5,
        offset: 10,
      });
      expect(result).toEqual([publicSubmission]);
    });

    it('passes undefined status and default pagination when no query is given', async () => {
      submissions.listPublic.mockResolvedValue([]);
      await controller.list(undefined, undefined, undefined);
      expect(submissions.listPublic).toHaveBeenCalledWith(undefined, {
        limit: 50,
        offset: 0,
      });
    });

    it('caps limit at the maximum and floors a negative offset', async () => {
      submissions.listPublic.mockResolvedValue([]);
      await controller.list(undefined, '9999', '-3');
      expect(submissions.listPublic).toHaveBeenCalledWith(undefined, {
        limit: 50,
        offset: 0,
      });
    });
  });

  describe('search', () => {
    it('returns an empty array without calling the search service for a blank query', async () => {
      const result = await controller.search_('   ');
      expect(result).toEqual([]);
      expect(search.search).not.toHaveBeenCalled();
      expect(submissions.findPublicByIds).not.toHaveBeenCalled();
    });

    it('maps search hits to ids and resolves them through the service', async () => {
      search.search.mockResolvedValue([
        { id: 'a', score: 1 },
        { id: 'b', score: 0.5 },
      ]);
      submissions.findPublicByIds.mockResolvedValue([publicSubmission]);
      const result = await controller.search_('sql', '5');
      expect(search.search).toHaveBeenCalledWith('sql', 5);
      expect(submissions.findPublicByIds).toHaveBeenCalledWith(['a', 'b']);
      expect(result).toEqual([publicSubmission]);
    });
  });

  describe('suggest', () => {
    it('returns an empty array without calling the search service for a blank query', async () => {
      const result = await controller.suggest('');
      expect(result).toEqual([]);
      expect(search.suggest).not.toHaveBeenCalled();
    });

    it('maps suggestions to id/title pairs', async () => {
      search.suggest.mockResolvedValue([
        { id: 'a', title: 'First', score: 2 },
        { id: 'b', title: 'Second', score: 1 },
      ]);
      const result = await controller.suggest('fi', '3');
      expect(search.suggest).toHaveBeenCalledWith('fi', 3);
      const expected: SubmissionSuggestion[] = [
        { id: 'a', title: 'First' },
        { id: 'b', title: 'Second' },
      ];
      expect(result).toEqual(expected);
    });
  });
});
