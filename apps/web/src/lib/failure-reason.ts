import type { RunFailureCode, RunFailureParams } from '@dotlearn/lesson-engine';
import { useTranslation } from 'react-i18next';

export interface FailureReason {
  reason: string;
  code?: RunFailureCode;
  params?: RunFailureParams;
}

export const extractFailureReason = (result: {
  ok: boolean;
  reason?: string;
  code?: RunFailureCode;
  params?: RunFailureParams;
}): FailureReason => ({
  reason: result.reason ?? '',
  ...(result.code !== undefined ? { code: result.code } : {}),
  ...(result.params !== undefined ? { params: result.params } : {}),
});

export const useFailureMessage = (): ((failure: FailureReason) => string) => {
  const { t } = useTranslation('runners');
  return (failure) =>
    failure.code
      ? t(`reasons.${failure.code}`, { ...failure.params, defaultValue: failure.reason })
      : failure.reason;
};
