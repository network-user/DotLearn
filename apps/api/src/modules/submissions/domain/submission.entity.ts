import { randomUUID } from 'node:crypto';

import type {
  CreateSubmissionInput,
  Submission,
  SubmissionSource,
  SubmissionStatus,
} from '@dotlearn/contracts';

export class SubmissionEntity {
  private constructor(
    public readonly id: string,
    public status: SubmissionStatus,
    public readonly source: SubmissionSource,
    public readonly createdAt: Date,
    public reviewedAt: Date | null,
    public reviewerNote: string | null,
    public readonly payload: CreateSubmissionInput,
  ) {}

  static create(payload: CreateSubmissionInput, source: SubmissionSource): SubmissionEntity {
    return new SubmissionEntity(randomUUID(), 'pending', source, new Date(), null, null, payload);
  }

  static restore(snapshot: {
    id: string;
    status: SubmissionStatus;
    source: SubmissionSource;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewerNote: string | null;
    payload: CreateSubmissionInput;
  }): SubmissionEntity {
    return new SubmissionEntity(
      snapshot.id,
      snapshot.status,
      snapshot.source,
      snapshot.createdAt,
      snapshot.reviewedAt,
      snapshot.reviewerNote,
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

  markMaterialized(): void {
    if (this.status !== 'approved') {
      throw new Error(`Submission ${this.id} must be approved before materialization`);
    }
    this.status = 'materialized';
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
    };
  }

  private assertReviewable(): void {
    if (this.status !== 'pending') {
      throw new Error(`Submission ${this.id} is ${this.status}; only pending submissions can be reviewed`);
    }
  }
}
