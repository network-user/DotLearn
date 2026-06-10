import { randomUUID } from 'node:crypto';

import type {
  CreateSubmissionInput,
  Submission,
  SubmissionSource,
  SubmissionStatus,
} from '@dotlearn/contracts';

import { DomainError } from '../../../common/errors/domain-error';

export class SubmissionEntity {
  private constructor(
    public readonly id: string,
    public status: SubmissionStatus,
    public readonly source: SubmissionSource,
    public readonly createdAt: Date,
    public reviewedAt: Date | null,
    public reviewerNote: string | null,
    public materializedSlug: string | null,
    public readonly payload: CreateSubmissionInput,
  ) {}

  static create(payload: CreateSubmissionInput, source: SubmissionSource): SubmissionEntity {
    return new SubmissionEntity(
      randomUUID(),
      'pending',
      source,
      new Date(),
      null,
      null,
      null,
      payload,
    );
  }

  static restore(snapshot: {
    id: string;
    status: SubmissionStatus;
    source: SubmissionSource;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewerNote: string | null;
    materializedSlug: string | null;
    payload: CreateSubmissionInput;
  }): SubmissionEntity {
    return new SubmissionEntity(
      snapshot.id,
      snapshot.status,
      snapshot.source,
      snapshot.createdAt,
      snapshot.reviewedAt,
      snapshot.reviewerNote,
      snapshot.materializedSlug,
      snapshot.payload,
    );
  }

  approve(reviewerNote?: string): void {
    this.assertReviewable();
    this.status = 'approved';
    this.reviewedAt = new Date();
    this.reviewerNote = reviewerNote ?? null;
  }

  reject(reviewerNote?: string): void {
    this.assertReviewable();
    this.status = 'rejected';
    this.reviewedAt = new Date();
    this.reviewerNote = reviewerNote ?? null;
  }

  markMaterialized(materializedSlug?: string, reviewerNote?: string): void {
    if (this.status !== 'approved') {
      throw new DomainError(
        `Submission ${this.id} must be approved before materialization`,
        422,
        'SubmissionNotApproved',
      );
    }
    this.status = 'materialized';
    if (materializedSlug) {
      this.materializedSlug = materializedSlug;
    }
    if (reviewerNote) {
      this.reviewerNote = reviewerNote;
    }
  }

  toContract(): Submission {
    return {
      id: this.id,
      status: this.status,
      source: this.source,
      createdAt: this.createdAt.toISOString(),
      payload: this.payload,
      ...(this.reviewedAt ? { reviewedAt: this.reviewedAt.toISOString() } : {}),
      ...(this.reviewerNote ? { reviewerNote: this.reviewerNote } : {}),
      ...(this.materializedSlug ? { materializedSlug: this.materializedSlug } : {}),
    };
  }

  private assertReviewable(): void {
    if (this.status !== 'pending') {
      throw new DomainError(
        `Submission ${this.id} is ${this.status}; only pending submissions can be reviewed`,
        409,
        'SubmissionNotReviewable',
      );
    }
  }
}
