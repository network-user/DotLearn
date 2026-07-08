import type {
  CreateSubmissionInput,
  MarkMaterializedInput,
  ReviewSubmissionInput,
  Submission,
} from '@dotlearn/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequest } from '../auth/guards/admin-auth.guard';
import type { SubmissionsSearchIndexer } from '../search/submissions-search.indexer';
import { AdminSubmissionsController } from './admin-submissions.controller';
import type { SubmissionsService } from './submissions.service';

const adminRequest = {
  admin: { sub: 'admin', jti: 'jti-1', scope: 'access', epoch: 0, exp: 0, iat: 0 },
  ip: '203.0.113.5',
} as unknown as AuthenticatedRequest;

const submissionId = '22222222-2222-4222-8222-222222222222';

const payload: CreateSubmissionInput = {
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

const reviewedSubmission: Submission = {
  id: submissionId,
  status: 'approved',
  source: 'in-app',
  createdAt: '2026-01-01T00:00:00.000Z',
  reviewedAt: '2026-01-02T00:00:00.000Z',
  payload,
};

const materializedSubmission: Submission = {
  ...reviewedSubmission,
  status: 'materialized',
  materializedSlug: 'sql-window-functions',
};

interface SubmissionsServiceMock {
  list: ReturnType<typeof vi.fn>;
  review: ReturnType<typeof vi.fn>;
  markMaterialized: ReturnType<typeof vi.fn>;
}

interface IndexerMock {
  indexOne: ReturnType<typeof vi.fn>;
}

describe('AdminSubmissionsController', () => {
  let controller: AdminSubmissionsController;
  let submissions: SubmissionsServiceMock;
  let indexer: IndexerMock;

  beforeEach(() => {
    submissions = {
      list: vi.fn(),
      review: vi.fn(),
      markMaterialized: vi.fn(),
    };
    indexer = {
      indexOne: vi.fn().mockResolvedValue(undefined),
    };
    controller = new AdminSubmissionsController(
      submissions as unknown as SubmissionsService,
      indexer as unknown as SubmissionsSearchIndexer,
    );
  });

  describe('list', () => {
    it('parses the status filter before delegating to the service', async () => {
      submissions.list.mockResolvedValue([reviewedSubmission]);
      const result = await controller.list('pending');
      expect(submissions.list).toHaveBeenCalledWith('pending');
      expect(result).toEqual([reviewedSubmission]);
    });

    it('passes undefined when no status query is supplied', async () => {
      submissions.list.mockResolvedValue([]);
      await controller.list(undefined);
      expect(submissions.list).toHaveBeenCalledWith(undefined);
    });
  });

  describe('review', () => {
    it('reviews the submission, reindexes it, and returns the result', async () => {
      submissions.review.mockResolvedValue(reviewedSubmission);
      const body: ReviewSubmissionInput = { decision: 'approve', reviewerNote: 'ok' };
      const result = await controller.review(submissionId, body, adminRequest);
      expect(submissions.review).toHaveBeenCalledWith(submissionId, body, {
        jti: 'jti-1',
        ip: '203.0.113.5',
      });
      expect(indexer.indexOne).toHaveBeenCalledWith(submissionId);
      expect(result).toBe(reviewedSubmission);
    });
  });

  describe('materialize', () => {
    it('materializes the submission, reindexes it, and returns the result', async () => {
      submissions.markMaterialized.mockResolvedValue(materializedSubmission);
      const body: MarkMaterializedInput = { materializedSlug: 'sql-window-functions' };
      const result = await controller.materialize(submissionId, body, adminRequest);
      expect(submissions.markMaterialized).toHaveBeenCalledWith(submissionId, body, {
        jti: 'jti-1',
        ip: '203.0.113.5',
      });
      expect(indexer.indexOne).toHaveBeenCalledWith(submissionId);
      expect(result).toBe(materializedSubmission);
    });
  });
});
