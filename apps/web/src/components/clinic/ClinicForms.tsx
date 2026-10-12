import { useState } from 'react';

import {
  personName,
  saveAppointment,
  saveNamed,
  savePerson,
  saveReception,
  toggleAppointmentMark,
  toggleCatalogMark,
  toggleReceptionMark,
  type ClinicState,
  type NamedRecord,
  type Reception,
} from '@dotlearn/lesson-engine';

import {
  ActionButton,
  CommandBar,
  Field,
  MissingRecord,
  PanelTitle,
  fieldClass,
} from '@/components/clinic/chrome';
import {
  appointmentCaption,
  doctorName,
  formatDay,
  formatNumber,
  nowStamp,
  officeName,
  parseDecimal,
  patientName,
  today,
} from '@/components/clinic/format';
import { runClinic } from '@/components/clinic/run';
import {
  appointmentScreen,
  listScreen,
  namedScreen,
  personScreen,
  receptionScreen,
  registerScreen,
  type ClinicScreen,
} from '@/components/clinic/screen';

interface EditorProps {
  state: ClinicState;
  onState: (state: ClinicState) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onOpen: (screen: ClinicScreen) => void;
}

const choices = <T extends { id: string; marked: boolean }>(
  items: readonly T[],
  selected: string,
  labelOf: (item: T) => string,
): { id: string; label: string }[] =>
  items
    .filter((item) => !item.marked || item.id === selected)
    .map((item) => ({
      id: item.id,
      label: item.marked ? `${labelOf(item)} (удалён)` : labelOf(item),
    }));

const finish = (
  result: { ok: true; id: string | null } | { ok: false },
  onNotice: (message: string | null) => void,
  message: string,
  next: (id: string) => void,
): void => {
  if (!result.ok || result.id === null) return;
  onNotice(message);
  next(result.id);
};

export const PersonForm = ({
  state,
  catalog,
  recordId,
  copyFrom,
  onState,
  onError,
  onNotice,
  onOpen,
}: EditorProps & {
  catalog: 'doctors' | 'patients';
  recordId: string | null;
  copyFrom: string | null;
}) => {
  const items = catalog === 'doctors' ? state.doctors : state.patients;
  const existing = recordId ? items.find((item) => item.id === recordId) : undefined;
  const copied = !recordId && copyFrom ? items.find((item) => item.id === copyFrom) : undefined;
  const source = existing ?? copied;
  const [lastName, setLastName] = useState(source?.lastName ?? '');
  const [firstName, setFirstName] = useState(source?.firstName ?? '');
  const [middleName, setMiddleName] = useState(source?.middleName ?? '');
  if ((recordId && !existing) || (copyFrom && !recordId && !copied)) {
    return <MissingRecord onBack={() => onOpen(listScreen(catalog))} />;
  }
  const persist = (close: boolean): void => {
    const result = runClinic(
      () => savePerson(state, catalog, { id: recordId, lastName, firstName, middleName }),
      onState,
      onError,
    );
    finish(result, onNotice, 'Записано', (id) => {
      if (close) onOpen(listScreen(catalog));
      else onOpen(personScreen(catalog, id));
    });
  };
  const mark = (): void => {
    if (!recordId) return;
    const result = runClinic(() => toggleCatalogMark(state, catalog, recordId), onState, onError);
    if (!result.ok) return;
    onOpen(listScreen(catalog));
  };
  return (
    <div>
      <PanelTitle
        title={catalog === 'doctors' ? 'Врач' : 'Пациент'}
        meta={existing?.marked ? 'помечен на удаление' : undefined}
      />
      <CommandBar>
        <ActionButton onClick={() => onOpen(listScreen(catalog))}>К списку</ActionButton>
        <ActionButton tone="primary" onClick={() => persist(false)}>
          Записать
        </ActionButton>
        <ActionButton onClick={() => persist(true)}>Записать и закрыть</ActionButton>
        {recordId ? (
          <ActionButton onClick={() => onOpen(personScreen(catalog, null, recordId))}>
            Создать копию
          </ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton tone="danger" onClick={mark}>
            {existing?.marked ? 'Восстановить' : 'Пометить на удаление'}
          </ActionButton>
        ) : null}
      </CommandBar>
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <Field label="Фамилия">
          <input
            className={fieldClass}
            value={lastName}
            autoComplete="off"
            onChange={(event) => setLastName(event.target.value)}
          />
        </Field>
        <Field label="Имя">
          <input
            className={fieldClass}
            value={firstName}
            autoComplete="off"
            onChange={(event) => setFirstName(event.target.value)}
          />
        </Field>
        <Field label="Отчество">
          <input
            className={fieldClass}
            value={middleName}
            autoComplete="off"
            onChange={(event) => setMiddleName(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
};

export const NamedForm = ({
  state,
  catalog,
  recordId,
  copyFrom,
  onState,
  onError,
  onNotice,
  onOpen,
}: EditorProps & {
  catalog: 'offices' | 'services';
  recordId: string | null;
  copyFrom: string | null;
}) => {
  const items = catalog === 'offices' ? state.offices : state.services;
  const existing = recordId ? items.find((item) => item.id === recordId) : undefined;
  const copied = !recordId && copyFrom ? items.find((item) => item.id === copyFrom) : undefined;
  const source = existing ?? copied;
  const [name, setName] = useState(source?.name ?? '');
  if ((recordId && !existing) || (copyFrom && !recordId && !copied)) {
    return <MissingRecord onBack={() => onOpen(listScreen(catalog))} />;
  }
  const persist = (close: boolean): void => {
    const result = runClinic(
      () => saveNamed(state, catalog, { id: recordId, name }),
      onState,
      onError,
    );
    finish(result, onNotice, 'Записано', (id) => {
      if (close) onOpen(listScreen(catalog));
      else onOpen(namedScreen(catalog, id));
    });
  };
  const mark = (): void => {
    if (!recordId) return;
    const result = runClinic(() => toggleCatalogMark(state, catalog, recordId), onState, onError);
    if (!result.ok) return;
    onOpen(listScreen(catalog));
  };
  return (
    <div>
      <PanelTitle
        title={catalog === 'offices' ? 'Кабинет' : 'Услуга'}
        meta={existing?.marked ? 'помечен на удаление' : undefined}
      />
      <CommandBar>
        <ActionButton onClick={() => onOpen(listScreen(catalog))}>К списку</ActionButton>
        <ActionButton tone="primary" onClick={() => persist(false)}>
          Записать
        </ActionButton>
        <ActionButton onClick={() => persist(true)}>Записать и закрыть</ActionButton>
        {recordId ? (
          <ActionButton onClick={() => onOpen(namedScreen(catalog, null, recordId))}>
            Создать копию
          </ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton tone="danger" onClick={mark}>
            {existing?.marked ? 'Восстановить' : 'Пометить на удаление'}
          </ActionButton>
        ) : null}
      </CommandBar>
      <div className="p-3 sm:max-w-md">
        <Field label="Наименование">
          <input
            className={fieldClass}
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
};

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; label: string }[];
}) => (
  <Field label={label}>
    <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Выберите</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </Field>
);

export const AppointmentForm = ({
  state,
  recordId,
  copyFrom,
  onState,
  onError,
  onNotice,
  onOpen,
}: EditorProps & { recordId: string | null; copyFrom: string | null }) => {
  const existing = recordId ? state.appointments.find((item) => item.id === recordId) : undefined;
  const copied =
    !recordId && copyFrom ? state.appointments.find((item) => item.id === copyFrom) : undefined;
  const source = existing ?? copied;
  const [createdAt, setCreatedAt] = useState(source?.createdAt ?? nowStamp());
  const [visitDate, setVisitDate] = useState(source?.visitDate ?? today());
  const [patientId, setPatientId] = useState(source?.patientId ?? '');
  const [doctorId, setDoctorId] = useState(source?.doctorId ?? '');
  const [officeId, setOfficeId] = useState(source?.officeId ?? '');
  if ((recordId && !existing) || (copyFrom && !recordId && !copied)) {
    return <MissingRecord onBack={() => onOpen(listScreen('appointments'))} />;
  }
  const persist = (close: boolean): void => {
    const result = runClinic(
      () =>
        saveAppointment(state, {
          id: recordId,
          createdAt,
          visitDate,
          patientId,
          doctorId,
          officeId,
        }),
      onState,
      onError,
    );
    finish(result, onNotice, 'Записано', (id) => {
      if (close) onOpen(listScreen('appointments'));
      else onOpen(appointmentScreen(id));
    });
  };
  const mark = (): void => {
    if (!recordId) return;
    const result = runClinic(() => toggleAppointmentMark(state, recordId), onState, onError);
    if (!result.ok) return;
    onOpen(listScreen('appointments'));
  };
  return (
    <div>
      <PanelTitle
        title="Запись на приём"
        meta={
          existing
            ? `№${existing.number}${existing.marked ? ' · помечена на удаление' : ''}`
            : 'номер присвоится при записи'
        }
      />
      <CommandBar>
        <ActionButton onClick={() => onOpen(listScreen('appointments'))}>К списку</ActionButton>
        <ActionButton tone="primary" onClick={() => persist(false)}>
          Записать
        </ActionButton>
        <ActionButton onClick={() => persist(true)}>Записать и закрыть</ActionButton>
        {recordId ? (
          <ActionButton onClick={() => onOpen(receptionScreen(null, recordId))}>
            Приём на основании
          </ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton onClick={() => onOpen(appointmentScreen(null, recordId))}>
            Создать копию
          </ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton tone="danger" onClick={mark}>
            {existing?.marked ? 'Восстановить' : 'Пометить на удаление'}
          </ActionButton>
        ) : null}
      </CommandBar>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <Field label="Дата документа">
          <input
            className={fieldClass}
            type="datetime-local"
            value={createdAt}
            onChange={(event) => setCreatedAt(event.target.value)}
          />
        </Field>
        <Field label="Дата приёма">
          <input
            className={fieldClass}
            type="date"
            value={visitDate}
            onChange={(event) => setVisitDate(event.target.value)}
          />
        </Field>
        <SelectField
          label="Пациент"
          value={patientId}
          onChange={setPatientId}
          options={choices(state.patients, patientId, personName)}
        />
        <SelectField
          label="Врач"
          value={doctorId}
          onChange={setDoctorId}
          options={choices(state.doctors, doctorId, personName)}
        />
        <SelectField
          label="Кабинет"
          value={officeId}
          onChange={setOfficeId}
          options={choices(state.offices, officeId, (item: NamedRecord) => item.name)}
        />
      </div>
    </div>
  );
};

interface LineInput {
  serviceId: string;
  quantity: string;
  price: string;
}

const lineInputsOf = (reception: Reception | undefined): LineInput[] =>
  reception && reception.lines.length > 0
    ? reception.lines.map((line) => ({
        serviceId: line.serviceId,
        quantity: String(line.quantity),
        price: String(line.price),
      }))
    : [{ serviceId: '', quantity: '1', price: '' }];

const lineAmount = (line: LineInput): number => {
  const quantity = parseDecimal(line.quantity);
  const price = parseDecimal(line.price);
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) return 0;
  return Math.round(quantity * price * 100) / 100;
};

export const ReceptionForm = ({
  state,
  recordId,
  fromAppointmentId,
  copyFrom,
  onState,
  onError,
  onNotice,
  onOpen,
}: EditorProps & {
  recordId: string | null;
  fromAppointmentId: string | null;
  copyFrom: string | null;
}) => {
  const existing = recordId ? state.receptions.find((item) => item.id === recordId) : undefined;
  const copied =
    !recordId && copyFrom ? state.receptions.find((item) => item.id === copyFrom) : undefined;
  const source = existing ?? copied;
  const [createdAt, setCreatedAt] = useState(source?.createdAt ?? nowStamp());
  const [appointmentId, setAppointmentId] = useState(
    source?.appointmentId ?? fromAppointmentId ?? '',
  );
  const [duration, setDuration] = useState(source ? String(source.duration) : '');
  const [lines, setLines] = useState<LineInput[]>(() => lineInputsOf(source));
  if ((recordId && !existing) || (copyFrom && !recordId && !copied)) {
    return <MissingRecord onBack={() => onOpen(listScreen('receptions'))} />;
  }
  const selected = state.appointments.find((item) => item.id === appointmentId);
  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const persist = (mode: 'write' | 'post' | 'unpost', close: boolean, message: string): void => {
    if (duration.trim().length === 0) {
      onNotice(null);
      onError('Укажите длительность приёма в минутах');
      return;
    }
    const result = runClinic(
      () =>
        saveReception(
          state,
          {
            id: recordId,
            createdAt,
            appointmentId,
            duration: parseDecimal(duration),
            lines: lines.flatMap((line) => {
              if (line.serviceId === '' && line.price.trim() === '') return [];
              return [
                {
                  serviceId: line.serviceId,
                  quantity: parseDecimal(line.quantity),
                  price: parseDecimal(line.price),
                },
              ];
            }),
          },
          mode,
        ),
      onState,
      onError,
    );
    finish(result, onNotice, message, (id) => {
      if (close) onOpen(listScreen('receptions'));
      else onOpen(receptionScreen(id));
    });
  };
  const moveLine = (index: number, direction: -1 | 1): void => {
    setLines((current) => {
      const target = index + direction;
      const item = current[index];
      if (item === undefined || target < 0 || target >= current.length) return current;
      const next = [...current];
      next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };
  const mark = (): void => {
    if (!recordId) return;
    const result = runClinic(() => toggleReceptionMark(state, recordId), onState, onError);
    if (!result.ok) return;
    onOpen(listScreen('receptions'));
  };
  const status = [
    existing ? `№${existing.number}` : 'номер присвоится при записи',
    existing?.posted ? 'проведён' : null,
    existing?.marked ? 'помечен на удаление' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <div>
      <PanelTitle title="Приём пациента" meta={status} />
      <CommandBar>
        <ActionButton onClick={() => onOpen(listScreen('receptions'))}>К списку</ActionButton>
        <ActionButton onClick={() => persist('write', false, 'Записано')}>
          Сохранить изменения
        </ActionButton>
        <ActionButton tone="primary" onClick={() => persist('post', true, 'Приём проведён')}>
          Провести и закрыть
        </ActionButton>
        {existing?.posted ? (
          <ActionButton onClick={() => persist('unpost', false, 'Проведение отменено')}>
            Отменить проведение
          </ActionButton>
        ) : null}
        {existing?.posted ? (
          <ActionButton onClick={() => onOpen(registerScreen(recordId))}>Движения</ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton onClick={() => onOpen(receptionScreen(null, null, recordId))}>
            Создать копию
          </ActionButton>
        ) : null}
        {recordId ? (
          <ActionButton tone="danger" onClick={mark}>
            {existing?.marked ? 'Восстановить' : 'Пометить на удаление'}
          </ActionButton>
        ) : null}
      </CommandBar>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <Field label="Дата">
          <input
            className={fieldClass}
            type="datetime-local"
            value={createdAt}
            onChange={(event) => setCreatedAt(event.target.value)}
          />
        </Field>
        <SelectField
          label="Запись на приём"
          value={appointmentId}
          onChange={setAppointmentId}
          options={choices(state.appointments, appointmentId, (item) =>
            appointmentCaption(state, item),
          )}
        />
        <Field label="Длительность, мин">
          <input
            className={fieldClass}
            inputMode="decimal"
            value={duration}
            autoComplete="off"
            onChange={(event) => setDuration(event.target.value)}
          />
        </Field>
        <Field label="Сумма">
          <input className={fieldClass} value={formatNumber(total)} readOnly />
        </Field>
      </div>
      {selected ? (
        <dl className="mx-3 mb-3 grid gap-2 rounded-md border border-[#e4d8c6] bg-[#fffdf8] p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[#5c6b7a]">Пациент</dt>
            <dd>{patientName(state, selected.patientId)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#5c6b7a]">Врач</dt>
            <dd>{doctorName(state, selected.doctorId)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#5c6b7a]">Кабинет</dt>
            <dd>{officeName(state, selected.officeId)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#5c6b7a]">Дата приёма</dt>
            <dd>{formatDay(selected.visitDate)}</dd>
          </div>
        </dl>
      ) : null}
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Список услуг приёма</caption>
          <thead>
            <tr className="text-xs font-medium text-[#5c6b7a]">
              {['Услуга', 'Количество', 'Цена', 'Сумма', ''].map((title) => (
                <th key={title || 'actions'} className="px-2 py-2 font-medium">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-[#e4d8c6]">
                <td className="px-2 py-2">
                  <select
                    aria-label={`Услуга, строка ${index + 1}`}
                    className={fieldClass}
                    value={line.serviceId}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, serviceId: event.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Выберите</option>
                    {choices(state.services, line.serviceId, (item) => item.name).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Количество, строка ${index + 1}`}
                    className={fieldClass}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, quantity: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Цена, строка ${index + 1}`}
                    className={fieldClass}
                    inputMode="decimal"
                    value={line.price}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, price: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2 tabular-nums">{formatNumber(lineAmount(line))}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <ActionButton
                      aria-label={`Поднять строку ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => moveLine(index, -1)}
                    >
                      Вверх
                    </ActionButton>
                    <ActionButton
                      aria-label={`Опустить строку ${index + 1}`}
                      disabled={index === lines.length - 1}
                      onClick={() => moveLine(index, 1)}
                    >
                      Вниз
                    </ActionButton>
                    <ActionButton
                      aria-label={`Удалить строку ${index + 1}`}
                      onClick={() =>
                        setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Удалить
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-2">
          <ActionButton
            onClick={() =>
              setLines((current) => [...current, { serviceId: '', quantity: '1', price: '' }])
            }
          >
            Добавить услугу
          </ActionButton>
        </div>
        <p className="max-w-prose pt-3 text-xs leading-relaxed text-[#5c6b7a]">
          При проведении каждая строка пишет движение: количество приёмов равно 1, выручка равна
          сумме строки, длительность берётся из шапки приёма. Врач подставляется из записи.
        </p>
      </div>
    </div>
  );
};
