import { demoClinic, parseClinicState, type ClinicState } from '@dotlearn/lesson-engine';

import { db } from '@/lib/progress-db';

const CLINIC_STATE_KEY = 'clinic:state';

export const loadClinicState = async (): Promise<ClinicState> => {
  const record = await db.playground.get(CLINIC_STATE_KEY);
  if (!record) return demoClinic();
  try {
    return parseClinicState(JSON.parse(record.value)) ?? demoClinic();
  } catch {
    return demoClinic();
  }
};

export const saveClinicState = async (state: ClinicState): Promise<void> => {
  await db.playground.put({
    id: CLINIC_STATE_KEY,
    value: JSON.stringify(state),
    updatedAt: new Date().toISOString(),
  });
};
