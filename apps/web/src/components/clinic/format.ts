import {
  personName,
  type Appointment,
  type ClinicState,
  type PersonRecord,
} from '@dotlearn/lesson-engine/clinic';

export const formatStamp = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]} ${match[4]}:${match[5]}`;
};

export const formatDay = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
};

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

export const nowStamp = (): string => {
  const date = new Date();
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const today = (): string => nowStamp().slice(0, 10);

export const parseDecimal = (value: string): number => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized.length === 0) return Number.NaN;
  return Number(normalized);
};

const named = (
  items: readonly { id: string; name: string }[],
  id: string,
  fallback: string,
): string => items.find((item) => item.id === id)?.name ?? fallback;

const namedPerson = (items: readonly PersonRecord[], id: string, fallback: string): string => {
  const person = items.find((item) => item.id === id);
  return person ? personName(person) : fallback;
};

export const doctorName = (state: ClinicState, id: string): string =>
  namedPerson(state.doctors, id, 'Врач не найден');

export const patientName = (state: ClinicState, id: string): string =>
  namedPerson(state.patients, id, 'Пациент не найден');

export const officeName = (state: ClinicState, id: string): string =>
  named(state.offices, id, 'Кабинет не найден');

export const serviceName = (state: ClinicState, id: string): string =>
  named(state.services, id, 'Услуга не найдена');

export const appointmentCaption = (state: ClinicState, item: Appointment): string =>
  `№${item.number} · ${formatDay(item.visitDate)} · ${patientName(state, item.patientId)} · ${doctorName(state, item.doctorId)} · каб. ${officeName(state, item.officeId)}`;
