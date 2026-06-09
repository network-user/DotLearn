import type {
  CreateSubmissionInput,
  HiddenTopic,
  HideTopicInput,
  MarkMaterializedInput,
  ReviewSubmissionInput,
  Submission,
  SubmissionPublic,
  SubmissionStatus,
  SubmissionSuggestion,
} from '@dotlearn/contracts';

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

interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  timestamp: string;
}

interface ErrorEnvelope {
  ok: false;
  error: { message?: string };
}

const unwrap = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    if (response.ok) return undefined as T;
    throw new ApiError(response.status, `${response.status} ${response.statusText}`);
  }
  let parsed: SuccessEnvelope<T> | ErrorEnvelope | T;
  try {
    parsed = JSON.parse(text) as SuccessEnvelope<T> | ErrorEnvelope | T;
  } catch {
    if (response.ok) return text as unknown as T;
    throw new ApiError(response.status, text);
  }
  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (parsed as ErrorEnvelope).error?.message ?? `${response.status} ${response.statusText}`
        : `${response.status} ${response.statusText}`;
    throw new ApiError(response.status, message);
  }
  if (typeof parsed === 'object' && parsed !== null && 'ok' in parsed && (parsed as SuccessEnvelope<T>).ok) {
    return (parsed as SuccessEnvelope<T>).data;
  }
  return parsed as T;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return unwrap<T>(response);
};

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const submitTopicProposal = (input: CreateSubmissionInput): Promise<Submission> =>
  request<Submission>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const listPublicSubmissions = (status?: SubmissionStatus): Promise<SubmissionPublic[]> =>
  request<SubmissionPublic[]>(`/api/submissions${buildQuery({ status })}`);

export const searchPublicSubmissions = (
  query: string,
  limit?: number,
): Promise<SubmissionPublic[]> =>
  request<SubmissionPublic[]>(
    `/api/submissions/search${buildQuery({ q: query, limit })}`,
  );

export const suggestSubmissions = (
  query: string,
  limit?: number,
): Promise<SubmissionSuggestion[]> =>
  request<SubmissionSuggestion[]>(
    `/api/submissions/suggest${buildQuery({ q: query, limit })}`,
  );

export const listAdminSubmissions = (status?: SubmissionStatus): Promise<Submission[]> =>
  request<Submission[]>(`/api/admin/submissions${buildQuery({ status })}`);

export const listPendingSubmissions = (): Promise<Submission[]> =>
  listAdminSubmissions('pending');

export const reviewSubmission = (
  id: string,
  decision: ReviewSubmissionInput,
): Promise<Submission> =>
  request<Submission>(`/api/admin/submissions/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(decision),
  });

export const markSubmissionMaterialized = (
  id: string,
  input: MarkMaterializedInput,
): Promise<Submission> =>
  request<Submission>(`/api/admin/submissions/${id}/materialize`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const listHiddenTopics = (): Promise<HiddenTopic[]> =>
  request<HiddenTopic[]>('/api/topics/hidden');

export const hideTopic = (slug: string, input: HideTopicInput): Promise<HiddenTopic> =>
  request<HiddenTopic>(`/api/admin/topics/${slug}/hide`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const unhideTopic = (slug: string): Promise<void> =>
  request<void>(`/api/admin/topics/${slug}/hide`, {
    method: 'DELETE',
  });

export { ApiError };
