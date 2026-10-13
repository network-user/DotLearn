import { DesignerCommand } from '@dotlearn/contracts';

import { db } from '@/lib/progress-db';

const PLANT_COMMANDS_KEY = 'plant:commands';

export const loadPlantCommands = async (): Promise<DesignerCommand[]> => {
  const record = await db.playground.get(PLANT_COMMANDS_KEY);
  if (!record) return [];
  try {
    const parsed = DesignerCommand.array().safeParse(JSON.parse(record.value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const savePlantCommands = async (commands: DesignerCommand[]): Promise<void> => {
  await db.playground.put({
    id: PLANT_COMMANDS_KEY,
    value: JSON.stringify(commands),
    updatedAt: new Date().toISOString(),
  });
};
