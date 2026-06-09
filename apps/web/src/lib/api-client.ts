import type { CreateSubmissionInput, ReviewSubmissionInput, Submission } from '@dotlearn/contracts';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
};

export const submitTopicProposal = (input: CreateSubmissionInput): Promise<Submission> =>
  request<Submission>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const listPendingSubmissions = (): Promise<Submission[]> =>
  request<Submission[]>('/api/admin/submissions?status=pending');

export const reviewSubmission = (id: string, decision: ReviewSubmissionInput): Promise<Submission> =>
  request<Submission>(`/api/admin/submissions/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(decision),
  });

export { ApiError };
