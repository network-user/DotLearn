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

import { refresh as refreshTokens } from './auth/auth-api';
import { getAccessToken, setAccessToken } from './auth/auth-storage';

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

export class StepUpRequiredError extends ApiError {
  constructor(public readonly action: string) {
    super(403, `Step-up required for action ${action}`);
    this.name = 'StepUpRequiredError';
  }
}

interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  timestamp: string;
}

interface ErrorEnvelope {
  ok: false;
  error?: { message?: string | { message?: string; action?: string }; action?: string };
}

const isStepUpEnvelope = (
  parsed: unknown,
): parsed is { ok: false; error: { message: { action: string } } } => {
  if (typeof parsed !== 'object' || parsed === null) return false;
  if (!('ok' in parsed) || (parsed as { ok: boolean }).ok !== false) return false;
  const error = (parsed as { error?: { message?: unknown; action?: unknown } }).error;
  if (!error) return false;
  const message = error.message;
  if (typeof message === 'object' && message !== null && 'action' in message) {
    return typeof (message as { action?: unknown }).action === 'string';
  }
  return false;
};

const extractStepUpAction = (parsed: unknown): string | undefined => {
  if (!isStepUpEnvelope(parsed)) return undefined;
  const message = (parsed as { error: { message: { action: string } } }).error.message;
  return message.action;
};

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
    if (response.status === 403) {
      const action = extractStepUpAction(parsed);
      if (action) {
        throw new StepUpRequiredError(action);
      }
    }
    const errorMessage =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (extractErrorMessage((parsed as ErrorEnvelope).error) ??
          `${response.status} ${response.statusText}`)
        : `${response.status} ${response.statusText}`;
    throw new ApiError(response.status, errorMessage);
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'ok' in parsed &&
    (parsed as SuccessEnvelope<T>).ok
  ) {
    return (parsed as SuccessEnvelope<T>).data;
  }
  return parsed as T;
};

const extractErrorMessage = (error: ErrorEnvelope['error']): string | undefined => {
  if (!error) return undefined;
  const message = error.message;
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null && 'message' in message) {
    return String((message as { message?: unknown }).message ?? '');
  }
  return undefined;
};

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

const buildHeaders = (init: RequestInit | undefined, withAuth: boolean): HeadersInit => {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (init?.headers) {
    for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
      baseHeaders[key] = value;
    }
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) baseHeaders.Authorization = `Bearer ${token.token}`;
  }
  return baseHeaders;
};

const request = async <T>(path: string, init?: RequestOptions): Promise<T> => {
  const withAuth = init?.auth !== false;
  const doFetch = async (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: buildHeaders(init, withAuth),
    });

  let response = await doFetch();
  if (response.status === 401 && withAuth && getAccessToken()) {
    try {
      const refreshed = await refreshTokens();
      const expiresAtMs = Date.parse(refreshed.accessExpiresAt);
      const previous = getAccessToken();
      setAccessToken({
        token: refreshed.accessToken,
        expiresAt: expiresAtMs,
        login: previous?.login ?? '',
      });
      response = await doFetch();
    } catch {
      setAccessToken(null);
      throw new ApiError(401, '401 Unauthorized');
    }
  }
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
    auth: false,
  });

export const listPublicSubmissions = (status?: SubmissionStatus): Promise<SubmissionPublic[]> =>
  request<SubmissionPublic[]>(`/api/submissions${buildQuery({ status })}`, { auth: false });

export const searchPublicSubmissions = (
  query: string,
  limit?: number,
): Promise<SubmissionPublic[]> =>
  request<SubmissionPublic[]>(`/api/submissions/search${buildQuery({ q: query, limit })}`, {
    auth: false,
  });

export const suggestSubmissions = (
  query: string,
  limit?: number,
): Promise<SubmissionSuggestion[]> =>
  request<SubmissionSuggestion[]>(`/api/submissions/suggest${buildQuery({ q: query, limit })}`, {
    auth: false,
  });

export const listAdminSubmissions = (status?: SubmissionStatus): Promise<Submission[]> =>
  request<Submission[]>(`/api/admin/submissions${buildQuery({ status })}`);

export const listPendingSubmissions = (): Promise<Submission[]> => listAdminSubmissions('pending');

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
  request<HiddenTopic[]>('/api/topics/hidden', { auth: false });

export const hideTopic = (slug: string, input: HideTopicInput): Promise<HiddenTopic> =>
  request<HiddenTopic>(`/api/admin/topics/${slug}/hide`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const unhideTopic = (slug: string): Promise<void> =>
  request<void>(`/api/admin/topics/${slug}/hide`, {
    method: 'DELETE',
  });

// --- Presence (anonymous online counter, public endpoints) ---

export interface PresenceBeatResult {
  online: number;
  uniquesToday: number;
}

export interface PresenceSeriesPoint {
  t: number;
  online: number;
}

export interface PresenceDailyPoint {
  day: string;
  uniques: number;
  peak: number;
}

export interface PresenceStats {
  online: number;
  uniquesToday: number;
  peakToday: number;
  series: PresenceSeriesPoint[];
  daily: PresenceDailyPoint[];
}

export const sendPresenceBeat = (id: string): Promise<PresenceBeatResult> =>
  request<PresenceBeatResult>('/api/presence/beat', {
    method: 'POST',
    body: JSON.stringify({ id }),
    auth: false,
  });

export const fetchPresenceStats = (): Promise<PresenceStats> =>
  request<PresenceStats>('/api/presence/stats', { auth: false });

export { ApiError };
