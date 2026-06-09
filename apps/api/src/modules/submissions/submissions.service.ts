import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type {
  CreateSubmissionInput,
  MarkMaterializedInput,
  ReviewSubmissionInput,
  Submission,
  SubmissionPublic,
  SubmissionPublicPayload,
  SubmissionSource,
  SubmissionStatus,
} from '@dotlearn/contracts';

import { SubmissionEntity } from './domain/submission.entity';
import {
  SUBMISSIONS_REPOSITORY,
  type SubmissionsRepository,
} from './infrastructure/submissions.repository';

const toPublic = (submission: Submission): SubmissionPublic => {
  const payload: SubmissionPublicPayload = {
    title: submission.payload.title,
    outline: submission.payload.outline,
    suggestedRuntime: submission.payload.suggestedRuntime,
    suggestedDifficulty: submission.payload.suggestedDifficulty,
    suggestedLanguage: submission.payload.suggestedLanguage,
    estimatedHours: submission.payload.estimatedHours,
    tags: [...submission.payload.tags],
    sources: [...submission.payload.sources],
  };
  return {
    id: submission.id,
    status: submission.status,
    source: submission.source,
    createdAt: submission.createdAt,
    payload,
    ...(submission.reviewedAt ? { reviewedAt: submission.reviewedAt } : {}),
    ...(submission.materializedSlug ? { materializedSlug: submission.materializedSlug } : {}),
  };
};

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

  async listPublic(status?: SubmissionStatus): Promise<SubmissionPublic[]> {
    const submissions = await this.list(status);
    return submissions.map(toPublic);
  }

  async findManyByIds(ids: string[]): Promise<Submission[]> {
    if (ids.length === 0) return [];
    const all = await this.repository.findAll();
    const map = new Map(all.map((entity) => [entity.id, entity]));
    const ordered: Submission[] = [];
    for (const id of ids) {
      const entity = map.get(id);
      if (entity) {
        ordered.push(entity.toContract());
      }
    }
    return ordered;
  }

  async findPublicByIds(ids: string[]): Promise<SubmissionPublic[]> {
    const submissions = await this.findManyByIds(ids);
    return submissions.map(toPublic);
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
    this.logger.log({ submissionId: id, decision: input.decision }, 'submission_reviewed');
    return entity.toContract();
  }

  async markMaterialized(id: string, input: MarkMaterializedInput): Promise<Submission> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Submission ${id} not found`);
    }
    entity.markMaterialized(input.materializedSlug, input.reviewerNote);
    await this.repository.save(entity);
    this.logger.log(
      { submissionId: id, materializedSlug: input.materializedSlug ?? null },
      'submission_materialized',
    );
    return entity.toContract();
  }

  static toPublic = toPublic;
}
