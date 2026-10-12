import { ClinicError, type ClinicState, type SavedRecord } from '@dotlearn/lesson-engine/clinic';

const isSaved = (value: SavedRecord | ClinicState): value is SavedRecord =>
  'state' in value && 'id' in value && !('doctors' in value);

export const runClinic = (
  action: () => SavedRecord | ClinicState,
  onState: (state: ClinicState) => void,
  onError: (message: string | null) => void,
): { ok: true; id: string | null } | { ok: false } => {
  try {
    const result = action();
    if (isSaved(result)) {
      onState(result.state);
      onError(null);
      return { ok: true, id: result.id };
    }
    onState(result);
    onError(null);
    return { ok: true, id: null };
  } catch (error) {
    onError(error instanceof ClinicError ? error.message : 'Операция не выполнилась');
    return { ok: false };
  }
};
