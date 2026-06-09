import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type {
  CreateSubmissionInput,
  ReviewSubmissionInput,
  Submission,
  SubmissionSource,
  SubmissionStatus,
} from '@dotlearn/contracts';

import { SubmissionEntity } from './domain/submission.entity';
import {
  SUBMISSIONS_REPOSITORY,
  type SubmissionsRepository,
} from './infrastructure/submissions.repository';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(SUBMISSIONS_REPOSITORY)
    private readonly repository: SubmissionsRepository,
  ) {}

  async create(input: CreateSubmissionInput, source: SubmissionSource): Promise<Submission> {
    const entity = SubmissionEntity.create(input, source);
    await this.repository.save(entity);
    this.logger.log(
      { submissionId: entity.id, source, runtime: input.suggestedRuntime },
      'submission_created',
    );
    return entity.toContract();
  }

  async list(status?: SubmissionStatus): Promise<Submission[]> {
    const entities = await this.repository.findMany(status ? { status } : {});
    return entities.map((entity) => entity.toContract());
  }

  async review(id: string, input: ReviewSubmissionInput): Promise<Submission> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    if (input.decision === 'approve') {
      entity.approve(input.reviewerNote);
    } else {
      entity.reject(input.reviewerNote);
    }

    await this.repository.save(entity);
    this.logger.log(
      { submissionId: id, decision: input.decision },
      'submission_reviewed',
    );
    return entity.toContract();
  }
}
