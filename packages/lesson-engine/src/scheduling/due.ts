export interface CardScheduleRecord {
  due: string;
}

export type CardClassification = 'new' | 'due' | 'later';

export const isCardDue = (record: CardScheduleRecord | undefined, now: Date): boolean => {
  if (!record) return true;
  return new Date(record.due).getTime() <= now.getTime();
};

export const classifyCard = (
  record: CardScheduleRecord | undefined,
  now: Date,
): CardClassification => {
  if (!record) return 'new';
  return new Date(record.due).getTime() <= now.getTime() ? 'due' : 'later';
};
