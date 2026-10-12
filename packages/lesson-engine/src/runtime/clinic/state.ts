import { z } from 'zod';

import { ClinicError } from './errors';

function fail(code: string, message: string): never {
  throw new ClinicError(code, message);
}

function must<T>(value: T | undefined, code: string, message: string): T {
  if (value === undefined) fail(code, message);
  return value;
}

const PersonSchema = z.object({
  id: z.string().min(1),
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string(),
  marked: z.boolean(),
});

const NamedSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  marked: z.boolean(),
});

const AppointmentSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  createdAt: z.string().min(1),
  patientId: z.string().min(1),
  visitDate: z.string().min(1),
  doctorId: z.string().min(1),
  officeId: z.string().min(1),
  marked: z.boolean(),
});

const ServiceLineSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  quantity: z.number().finite(),
  price: z.number().finite(),
  amount: z.number().finite(),
});

const ReceptionSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  createdAt: z.string().min(1),
  appointmentId: z.string().min(1),
  duration: z.number().finite(),
  posted: z.boolean(),
  marked: z.boolean(),
  lines: z.array(ServiceLineSchema),
});

const MovementSchema = z.object({
  id: z.string().min(1),
  registrarId: z.string().min(1),
  period: z.string().min(1),
  doctorId: z.string().min(1),
  serviceId: z.string().min(1),
  count: z.number().finite(),
  revenue: z.number().finite(),
  duration: z.number().finite(),
});

const ClinicStateSchema = z.object({
  doctors: z.array(PersonSchema),
  offices: z.array(NamedSchema),
  patients: z.array(PersonSchema),
  services: z.array(NamedSchema),
  appointments: z.array(AppointmentSchema),
  receptions: z.array(ReceptionSchema),
  movements: z.array(MovementSchema),
  seq: z.number().int().nonnegative(),
});

export type PersonRecord = z.infer<typeof PersonSchema>;
export type NamedRecord = z.infer<typeof NamedSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type ServiceLine = z.infer<typeof ServiceLineSchema>;
export type Reception = z.infer<typeof ReceptionSchema>;
export type Movement = z.infer<typeof MovementSchema>;
export type ClinicState = z.infer<typeof ClinicStateSchema>;

export type CatalogKind = 'doctors' | 'offices' | 'patients' | 'services';
export type WriteMode = 'write' | 'post' | 'unpost';

export interface PersonDraft {
  id: string | null;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface NamedDraft {
  id: string | null;
  name: string;
}

export interface AppointmentDraft {
  id: string | null;
  createdAt: string;
  patientId: string;
  visitDate: string;
  doctorId: string;
  officeId: string;
}

export interface ReceptionLineDraft {
  serviceId: string;
  quantity: number;
  price: number;
}

export interface ReceptionDraft {
  id: string | null;
  createdAt: string;
  appointmentId: string;
  duration: number;
  lines: ReceptionLineDraft[];
}

export interface SavedRecord {
  state: ClinicState;
  id: string;
}

export interface WorkloadRow {
  doctorId: string;
  serviceId: string;
  count: number;
  revenue: number;
  duration: number;
}

export interface DoctorLoad {
  doctorId: string;
  count: number;
  revenue: number;
  duration: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const clean = (value: string): string => value.trim().replace(/\s+/g, ' ');

const sameText = (left: string, right: string): boolean =>
  left.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru');

export const personName = (person: PersonRecord): string =>
  [person.lastName, person.firstName, person.middleName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');

const isDay = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const normalizeStamp = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  const day = must(match?.[1], 'date', 'Укажите дату и время');
  const hourText = must(match?.[2], 'date', 'Укажите дату и время');
  const minuteText = must(match?.[3], 'date', 'Укажите дату и время');
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!isDay(day) || hours > 23 || minutes > 59) fail('date', 'Некорректная дата');
  return `${day}T${hourText}:${minuteText}`;
};

const nextNumber = (numbers: readonly string[]): string => {
  let max = 0;
  for (const value of numbers) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > max) max = parsed;
  }
  return String(max + 1);
};

const replaceById = <T extends { id: string }>(items: readonly T[], next: T): T[] =>
  items.map((item) => (item.id === next.id ? next : item));

export const emptyClinic = (): ClinicState => ({
  doctors: [],
  offices: [],
  patients: [],
  services: [],
  appointments: [],
  receptions: [],
  movements: [],
  seq: 1,
});

export const demoClinic = (): ClinicState => ({
  doctors: [
    { id: 'doc-ivanov', lastName: 'Иванов', firstName: '', middleName: '', marked: false },
    { id: 'doc-petrov', lastName: 'Петров', firstName: '', middleName: '', marked: false },
  ],
  offices: [
    { id: 'off-1', name: '1', marked: false },
    { id: 'off-2', name: '2', marked: false },
  ],
  patients: [
    { id: 'pat-kozlova', lastName: 'Козлова', firstName: '', middleName: '', marked: false },
    { id: 'pat-sidorova', lastName: 'Сидорова', firstName: '', middleName: '', marked: false },
  ],
  services: [
    { id: 'srv-vax', name: 'Вакцинирование', marked: false },
    { id: 'srv-exam', name: 'Осмотр', marked: false },
    { id: 'srv-status', name: 'Анализ состояния', marked: false },
  ],
  appointments: [
    {
      id: 'app-1',
      number: '1',
      createdAt: '2026-05-09T19:05',
      patientId: 'pat-kozlova',
      visitDate: '2026-05-09',
      doctorId: 'doc-ivanov',
      officeId: 'off-1',
      marked: false,
    },
    {
      id: 'app-2',
      number: '2',
      createdAt: '2026-05-09T19:06',
      patientId: 'pat-sidorova',
      visitDate: '2026-05-09',
      doctorId: 'doc-petrov',
      officeId: 'off-2',
      marked: false,
    },
  ],
  receptions: [
    {
      id: 'rec-1',
      number: '1',
      createdAt: '2026-05-09T19:06',
      appointmentId: 'app-1',
      duration: 48,
      posted: true,
      marked: false,
      lines: [{ id: 'ln-1', serviceId: 'srv-exam', quantity: 1, price: 3000, amount: 3000 }],
    },
    {
      id: 'rec-2',
      number: '2',
      createdAt: '2026-05-09T19:06',
      appointmentId: 'app-2',
      duration: 25,
      posted: true,
      marked: false,
      lines: [{ id: 'ln-2', serviceId: 'srv-vax', quantity: 1, price: 2500, amount: 2500 }],
    },
  ],
  movements: [
    {
      id: 'mov-1',
      registrarId: 'rec-1',
      period: '2026-05-09T19:06',
      doctorId: 'doc-ivanov',
      serviceId: 'srv-exam',
      count: 1,
      revenue: 3000,
      duration: 48,
    },
    {
      id: 'mov-2',
      registrarId: 'rec-2',
      period: '2026-05-09T19:06',
      doctorId: 'doc-petrov',
      serviceId: 'srv-vax',
      count: 1,
      revenue: 2500,
      duration: 25,
    },
  ],
  seq: 100,
});

export const parseClinicState = (value: unknown): ClinicState | null => {
  const parsed = ClinicStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const personList = (state: ClinicState, kind: 'doctors' | 'patients'): PersonRecord[] =>
  kind === 'doctors' ? state.doctors : state.patients;

const namedList = (state: ClinicState, kind: 'offices' | 'services'): NamedRecord[] =>
  kind === 'offices' ? state.offices : state.services;

const withPersonList = (
  state: ClinicState,
  kind: 'doctors' | 'patients',
  items: PersonRecord[],
): ClinicState =>
  kind === 'doctors' ? { ...state, doctors: items } : { ...state, patients: items };

const withNamedList = (
  state: ClinicState,
  kind: 'offices' | 'services',
  items: NamedRecord[],
): ClinicState =>
  kind === 'offices' ? { ...state, offices: items } : { ...state, services: items };

export const savePerson = (
  state: ClinicState,
  kind: 'doctors' | 'patients',
  draft: PersonDraft,
): SavedRecord => {
  const lastName = clean(draft.lastName);
  const firstName = clean(draft.firstName);
  const middleName = clean(draft.middleName);
  if (!lastName) fail('name', 'Укажите фамилию');
  const items = personList(state, kind);
  const current = draft.id ? items.find((item) => item.id === draft.id) : undefined;
  if (draft.id && !current) fail('missing', 'Элемент справочника не найден');
  const name = personName({
    id: '',
    lastName,
    firstName,
    middleName,
    marked: false,
  });
  const duplicate = items.some(
    (item) => item.id !== current?.id && !item.marked && sameText(personName(item), name),
  );
  if (duplicate) fail('duplicate', `«${name}» уже есть в справочнике`);
  if (current) {
    const next = { ...current, lastName, firstName, middleName };
    return { state: withPersonList(state, kind, replaceById(items, next)), id: current.id };
  }
  const id = `${kind === 'doctors' ? 'doc' : 'pat'}-${state.seq}`;
  const created: PersonRecord = { id, lastName, firstName, middleName, marked: false };
  return {
    state: withPersonList({ ...state, seq: state.seq + 1 }, kind, [...items, created]),
    id,
  };
};

export const saveNamed = (
  state: ClinicState,
  kind: 'offices' | 'services',
  draft: NamedDraft,
): SavedRecord => {
  const name = clean(draft.name);
  if (!name) fail('name', 'Укажите наименование');
  const items = namedList(state, kind);
  const current = draft.id ? items.find((item) => item.id === draft.id) : undefined;
  if (draft.id && !current) fail('missing', 'Элемент справочника не найден');
  const duplicate = items.some(
    (item) => item.id !== current?.id && !item.marked && sameText(item.name, name),
  );
  if (duplicate) fail('duplicate', `«${name}» уже есть в справочнике`);
  if (current) {
    return {
      state: withNamedList(state, kind, replaceById(items, { ...current, name })),
      id: current.id,
    };
  }
  const id = `${kind === 'offices' ? 'off' : 'srv'}-${state.seq}`;
  return {
    state: withNamedList({ ...state, seq: state.seq + 1 }, kind, [
      ...items,
      { id, name, marked: false },
    ]),
    id,
  };
};

const requirePerson = (
  items: readonly PersonRecord[],
  id: string,
  label: string,
  keepMarkedId: string | null,
): PersonRecord => {
  const found = must(
    items.find((item) => item.id === id),
    'ref',
    `Укажите поле «${label}»`,
  );
  if (found.marked && found.id !== keepMarkedId) {
    fail('marked', `${label} «${personName(found)}» помечен на удаление`);
  }
  return found;
};

const requireNamed = (
  items: readonly NamedRecord[],
  id: string,
  label: string,
  keepMarkedId: string | null,
): NamedRecord => {
  const found = must(
    items.find((item) => item.id === id),
    'ref',
    `Укажите поле «${label}»`,
  );
  if (found.marked && found.id !== keepMarkedId) {
    fail('marked', `${label} «${found.name}» помечен на удаление`);
  }
  return found;
};

export const saveAppointment = (state: ClinicState, draft: AppointmentDraft): SavedRecord => {
  const current = draft.id ? state.appointments.find((item) => item.id === draft.id) : undefined;
  if (draft.id && !current) fail('missing', 'Запись на приём не найдена');
  const createdAt = normalizeStamp(draft.createdAt);
  if (!isDay(draft.visitDate)) fail('visit', 'Укажите дату приёма');
  const patient = requirePerson(
    state.patients,
    draft.patientId,
    'Пациент',
    current?.patientId ?? null,
  );
  const doctor = requirePerson(state.doctors, draft.doctorId, 'Врач', current?.doctorId ?? null);
  const office = requireNamed(state.offices, draft.officeId, 'Кабинет', current?.officeId ?? null);
  if (current) {
    const next: Appointment = {
      ...current,
      createdAt,
      patientId: patient.id,
      visitDate: draft.visitDate,
      doctorId: doctor.id,
      officeId: office.id,
    };
    return {
      state: { ...state, appointments: replaceById(state.appointments, next) },
      id: current.id,
    };
  }
  const id = `app-${state.seq}`;
  const created: Appointment = {
    id,
    number: nextNumber(state.appointments.map((item) => item.number)),
    createdAt,
    patientId: patient.id,
    visitDate: draft.visitDate,
    doctorId: doctor.id,
    officeId: office.id,
    marked: false,
  };
  return {
    state: { ...state, seq: state.seq + 1, appointments: [...state.appointments, created] },
    id,
  };
};

const buildLines = (
  state: ClinicState,
  draft: ReceptionDraft,
  seqStart: number,
  keptServiceIds: ReadonlySet<string>,
): { lines: ServiceLine[]; seq: number } => {
  let seq = seqStart;
  const lines = draft.lines.map((line, index) => {
    const service = must(
      state.services.find((item) => item.id === line.serviceId),
      'line',
      `В строке ${index + 1} укажите услугу`,
    );
    if (service.marked && !keptServiceIds.has(service.id)) {
      fail('marked', `Услуга «${service.name}» помечена на удаление`);
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      fail('line', `В строке ${index + 1} количество должно быть больше нуля`);
    }
    if (!Number.isFinite(line.price) || line.price < 0) {
      fail('line', `В строке ${index + 1} цена не может быть отрицательной`);
    }
    const id = `ln-${seq}`;
    seq += 1;
    return {
      id,
      serviceId: service.id,
      quantity: line.quantity,
      price: round2(line.price),
      amount: round2(line.quantity * line.price),
    };
  });
  return { lines, seq };
};

export const saveReception = (
  state: ClinicState,
  draft: ReceptionDraft,
  mode: WriteMode,
): SavedRecord => {
  const current = draft.id ? state.receptions.find((item) => item.id === draft.id) : undefined;
  if (draft.id && !current) fail('missing', 'Приём пациента не найден');
  if (!current && mode === 'unpost') fail('new', 'Сначала запишите приём');
  if (current?.marked && mode !== 'write') {
    fail('marked', 'Приём помечен на удаление');
  }
  const createdAt = normalizeStamp(draft.createdAt);
  const appointment = must(
    state.appointments.find((item) => item.id === draft.appointmentId),
    'appointment',
    'Укажите запись на приём',
  );
  if (appointment.marked) fail('marked', 'Запись на приём помечена на удаление');
  if (!Number.isFinite(draft.duration) || draft.duration < 0) {
    fail('duration', 'Длительность не может быть отрицательной');
  }
  const doctor = must(
    state.doctors.find((item) => item.id === appointment.doctorId),
    'doctor',
    'У записи не указан действующий врач',
  );
  if (doctor.marked) fail('doctor', 'У записи не указан действующий врач');

  const built = buildLines(
    state,
    draft,
    state.seq,
    new Set(current?.lines.map((line) => line.serviceId) ?? []),
  );
  const stayPosted = mode === 'write' && current?.posted === true;
  const posting = mode === 'post' || stayPosted;
  if (posting && built.lines.length === 0) fail('lines', 'Добавьте хотя бы одну услугу');
  if (posting && draft.duration <= 0) fail('duration', 'Укажите длительность приёма в минутах');

  let seq = built.seq;
  const id = current?.id ?? `rec-${seq++}`;
  const posted = mode === 'unpost' ? false : posting;
  const reception: Reception = {
    id,
    number: current?.number ?? nextNumber(state.receptions.map((item) => item.number)),
    createdAt,
    appointmentId: appointment.id,
    duration: draft.duration,
    posted,
    marked: current?.marked ?? false,
    lines: built.lines,
  };
  const movements: Movement[] = posted
    ? built.lines.map((line) => {
        const movement: Movement = {
          id: `mov-${seq}`,
          registrarId: id,
          period: createdAt,
          doctorId: doctor.id,
          serviceId: line.serviceId,
          count: 1,
          revenue: line.amount,
          duration: draft.duration,
        };
        seq += 1;
        return movement;
      })
    : [];
  const receptions = current
    ? replaceById(state.receptions, reception)
    : [...state.receptions, reception];
  return {
    state: {
      ...state,
      seq,
      receptions,
      movements: [...state.movements.filter((item) => item.registrarId !== id), ...movements],
    },
    id,
  };
};

const blockIf = (blocked: boolean, message: string): void => {
  if (blocked) fail('used', message);
};

export const toggleCatalogMark = (
  state: ClinicState,
  kind: CatalogKind,
  id: string,
): ClinicState => {
  if (kind === 'doctors' || kind === 'patients') {
    const items = personList(state, kind);
    const current = must(
      items.find((item) => item.id === id),
      'missing',
      'Элемент справочника не найден',
    );
    if (!current.marked) {
      const used = state.appointments.some(
        (item) =>
          !item.marked && (kind === 'doctors' ? item.doctorId === id : item.patientId === id),
      );
      blockIf(used, `«${personName(current)}» указан в записи на приём`);
    }
    return withPersonList(state, kind, replaceById(items, { ...current, marked: !current.marked }));
  }
  const items = namedList(state, kind);
  const current = must(
    items.find((item) => item.id === id),
    'missing',
    'Элемент справочника не найден',
  );
  if (!current.marked && kind === 'offices') {
    blockIf(
      state.appointments.some((item) => !item.marked && item.officeId === id),
      `Кабинет «${current.name}» указан в записи на приём`,
    );
  }
  if (!current.marked && kind === 'services') {
    blockIf(
      state.receptions.some(
        (item) => !item.marked && item.lines.some((line) => line.serviceId === id),
      ),
      `Услуга «${current.name}» указана в приёме пациента`,
    );
  }
  return withNamedList(state, kind, replaceById(items, { ...current, marked: !current.marked }));
};

export const toggleAppointmentMark = (state: ClinicState, id: string): ClinicState => {
  const current = must(
    state.appointments.find((item) => item.id === id),
    'missing',
    'Запись на приём не найдена',
  );
  if (!current.marked) {
    blockIf(
      state.receptions.some((item) => !item.marked && item.appointmentId === id),
      `По записи №${current.number} уже есть приём пациента`,
    );
  }
  return {
    ...state,
    appointments: replaceById(state.appointments, { ...current, marked: !current.marked }),
  };
};

export const toggleReceptionMark = (state: ClinicState, id: string): ClinicState => {
  const current = must(
    state.receptions.find((item) => item.id === id),
    'missing',
    'Приём пациента не найден',
  );
  const marked = !current.marked;
  return {
    ...state,
    receptions: replaceById(state.receptions, {
      ...current,
      marked,
      posted: marked ? false : current.posted,
    }),
    movements: marked ? state.movements.filter((item) => item.registrarId !== id) : state.movements,
  };
};

const addLoad = (
  map: Map<string, DoctorLoad>,
  doctorId: string,
  count: number,
  revenue: number,
  duration: number,
): void => {
  const current = map.get(doctorId) ?? { doctorId, count: 0, revenue: 0, duration: 0 };
  current.count += count;
  current.revenue = round2(current.revenue + revenue);
  current.duration = round2(current.duration + duration);
  map.set(doctorId, current);
};

export const workloadTable = (state: ClinicState): WorkloadRow[] => {
  const map = new Map<string, WorkloadRow>();
  for (const movement of state.movements) {
    const key = `${movement.doctorId}\0${movement.serviceId}`;
    const current = map.get(key) ?? {
      doctorId: movement.doctorId,
      serviceId: movement.serviceId,
      count: 0,
      revenue: 0,
      duration: 0,
    };
    current.count += movement.count;
    current.revenue = round2(current.revenue + movement.revenue);
    current.duration = round2(current.duration + movement.duration);
    map.set(key, current);
  }
  return [...map.values()].sort((left, right) => {
    const byDoctor = left.doctorId.localeCompare(right.doctorId, 'ru');
    return byDoctor === 0 ? left.serviceId.localeCompare(right.serviceId, 'ru') : byDoctor;
  });
};

export const doctorLoad = (state: ClinicState): DoctorLoad[] => {
  const map = new Map<string, DoctorLoad>();
  for (const row of workloadTable(state)) {
    addLoad(map, row.doctorId, row.count, row.revenue, row.duration);
  }
  return [...map.values()].sort((left, right) => left.doctorId.localeCompare(right.doctorId, 'ru'));
};
