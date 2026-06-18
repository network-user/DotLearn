import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

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
    suggestedLanguages: [...submission.payload.suggestedLanguages],
    suggestedPrimaryLanguage: submission.payload.suggestedPrimaryLanguage,
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

interface ListOptions {
  limit?: number;
  offset?: number;
}

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_SUBMISSIONS = parsePositiveInt(process.env.SUBMISSIONS_MAX, 5000);

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(SUBMISSIONS_REPOSITORY)
    private readonly repository: SubmissionsRepository,
  ) {}

  async create(input: CreateSubmissionInput, source: SubmissionSource): Promise<Submission> {
    if (source === 'in-app') {
      const existing = await this.repository.findAll();
      if (existing.length >= MAX_SUBMISSIONS) {
        this.logger.warn({ count: existing.length, max: MAX_SUBMISSIONS }, 'submission_store_full');
        throw new ServiceUnavailableException(
          'Submission storage is full; please try again later.',
        );
      }
    }
    const entity = SubmissionEntity.create(input, source);
    await this.repository.save(entity);
    this.logger.log(
      { submissionId: entity.id, source, runtime: input.suggestedRuntime },
      'submission_created',
    );
    return entity.toContract();
  }

  async list(status?: SubmissionStatus, options: ListOptions = {}): Promise<Submission[]> {
    const entities = await this.repository.findMany(status ? { status } : {});
    const offset = options.offset && options.offset > 0 ? options.offset : 0;
    const sliced =
      options.limit !== undefined
        ? entities.slice(offset, offset + options.limit)
        : entities.slice(offset);
    return sliced.map((entity) => entity.toContract());
  }

  async listPublic(
    status?: SubmissionStatus,
    options: ListOptions = {},
  ): Promise<SubmissionPublic[]> {
    const submissions = await this.list(status, options);
    return submissions.map(toPublic);
  }

  async findManyByIds(ids: string[]): Promise<Submission[]> {
    if (ids.length === 0) return [];
    const entities = await Promise.all(ids.map((id) => this.repository.findById(id)));
    return entities.flatMap((entity) => (entity ? [entity.toContract()] : []));
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
