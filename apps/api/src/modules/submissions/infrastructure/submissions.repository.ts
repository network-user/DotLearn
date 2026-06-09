import type { SubmissionStatus } from '@dotlearn/contracts';

import type { SubmissionEntity } from '../domain/submission.entity';

export const SUBMISSIONS_REPOSITORY = Symbol('SubmissionsRepository');

export type FindManyFilter = {
  status?: SubmissionStatus;
};

export interface SubmissionsRepository {
  save(submission: SubmissionEntity): Promise<void>;
  findById(id: string): Promise<SubmissionEntity | null>;
  findMany(filter: FindManyFilter): Promise<SubmissionEntity[]>;
  findAll(): Promise<SubmissionEntity[]>;
}
