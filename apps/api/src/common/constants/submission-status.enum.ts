export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MATERIALIZED: 'materialized',
} as const;

export type SubmissionStatusValue = (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];
