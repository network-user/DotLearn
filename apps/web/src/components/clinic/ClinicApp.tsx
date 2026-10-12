import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  demoClinic,
  emptyClinic,
  personName,
  type ClinicState,
  type Reception,
} from '@dotlearn/lesson-engine';

import {
  AppointmentForm,
  NamedForm,
  PersonForm,
  ReceptionForm,
} from '@/components/clinic/ClinicForms';
import { ChartView, RegisterView, ReportView } from '@/components/clinic/ClinicReports';
import { ActionButton, CommandBar, PanelTitle, fieldClass } from '@/components/clinic/chrome';
import {
  doctorName,
  formatDay,
  formatNumber,
  formatStamp,
  officeName,
  patientName,
} from '@/components/clinic/format';
import {
  listScreen,
  sectionOf,
  type ClinicScreen,
  type ListObject,
} from '@/components/clinic/screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/components/ui/cx';
import { loadClinicState, saveClinicState } from '@/lib/clinic-store';

const NAV: { title: string; items: { id: string; label: string; screen: ClinicScreen }[] }[] = [
  {
    title: 'НСИ',
    items: [
      { id: 'doctors', label: 'Врачи', screen: listScreen('doctors') },
      { id: 'offices', label: 'Кабинеты', screen: listScreen('offices') },
      { id: 'patients', label: 'Пациенты', screen: listScreen('patients') },
      { id: 'services', label: 'Услуги', screen: listScreen('services') },
    ],
  },
  {
    title: 'Учёт данных',
    items: [
      { id: 'appointments', label: 'Запись на приём', screen: listScreen('appointments') },
      { id: 'receptions', label: 'Приём пациента', screen: listScreen('receptions') },
      { id: 'register', label: 'Движения регистра', screen: { kind: 'register' } },
    ],
  },
  {
    title: 'Отчётность',
    items: [
      { id: 'report', label: 'Загруженность врачей', screen: { kind: 'report' } },
      { id: 'chart', label: 'График загруженности', screen: { kind: 'chart' } },
    ],
  },
];

const LIST_TITLES: Record<ListObject, string> = {
  doctors: 'Врачи',
  offices: 'Кабинеты',
  patients: 'Пациенты',
  services: 'Услуги',
  appointments: 'Запись на приём',
  receptions: 'Приём пациента',
};

const LIST_HEADERS: Record<ListObject, string[]> = {
  doctors: ['ФИО'],
  offices: ['Наименование'],
  patients: ['ФИО'],
  services: ['Наименование'],
  appointments: ['Номер', 'Дата', 'Пациент', 'Дата приёма', 'Врач', 'Кабинет'],
  receptions: ['Номер', 'Дата', 'Пациент', 'Врач', 'Сумма', 'Минуты', 'Проведён'],
};

interface Row {
  id: string;
  marked: boolean;
  cells: string[];
}

const receptionSum = (item: Reception): string =>
  formatNumber(item.lines.reduce((sum, line) => sum + line.amount, 0));

const rowsOf = (state: ClinicState, object: ListObject): Row[] => {
  if (object === 'doctors' || object === 'patients') {
    return (object === 'doctors' ? state.doctors : state.patients).map((item) => ({
      id: item.id,
      marked: item.marked,
      cells: [personName(item)],
    }));
  }
  if (object === 'offices' || object === 'services') {
    return (object === 'offices' ? state.offices : state.services).map((item) => ({
      id: item.id,
      marked: item.marked,
      cells: [item.name],
    }));
  }
  if (object === 'appointments') {
    return state.appointments.map((item) => ({
      id: item.id,
      marked: item.marked,
      cells: [
        `№${item.number}`,
        formatStamp(item.createdAt),
        patientName(state, item.patientId),
        formatDay(item.visitDate),
        doctorName(state, item.doctorId),
        officeName(state, item.officeId),
      ],
    }));
  }
  return state.receptions.map((item) => {
    const appointment = state.appointments.find((entry) => entry.id === item.appointmentId);
    return {
      id: item.id,
      marked: item.marked,
      cells: [
        `№${item.number}`,
        formatStamp(item.createdAt),
        appointment ? patientName(state, appointment.patientId) : 'не указано',
        appointment ? doctorName(state, appointment.doctorId) : 'не указано',
        receptionSum(item),
        formatNumber(item.duration),
        item.posted ? 'Да' : 'Нет',
      ],
    };
  });
};

const openCreated = (object: ListObject): ClinicScreen => {
  if (object === 'doctors' || object === 'patients') {
    return { kind: 'person', catalog: object, id: null };
  }
  if (object === 'offices' || object === 'services') {
    return { kind: 'named', catalog: object, id: null };
  }
  if (object === 'appointments') return { kind: 'appointment', id: null };
  return { kind: 'reception', id: null, fromAppointmentId: null };
};

const openExisting = (object: ListObject, id: string): ClinicScreen => {
  if (object === 'doctors' || object === 'patients') return { kind: 'person', catalog: object, id };
  if (object === 'offices' || object === 'services') return { kind: 'named', catalog: object, id };
  if (object === 'appointments') return { kind: 'appointment', id };
  return { kind: 'reception', id, fromAppointmentId: null };
};

const countActive = (items: readonly { marked: boolean }[]): number =>
  items.filter((item) => !item.marked).length;

const HomeView = ({
  state,
  onOpen,
}: {
  state: ClinicState;
  onOpen: (screen: ClinicScreen) => void;
}) => {
  const cards = [
    {
      title: 'Справочники',
      text: 'Врачи, кабинеты, пациенты и услуги.',
      screen: listScreen('doctors'),
    },
    {
      title: 'Запись на приём',
      text: 'Пациент, дата приёма, врач и кабинет.',
      screen: listScreen('appointments'),
    },
    {
      title: 'Приём пациента',
      text: 'Услуги, сумма, длительность и проведение.',
      screen: listScreen('receptions'),
    },
    {
      title: 'Загруженность врачей',
      text: 'Таблица и график по проведённым приёмам.',
      screen: { kind: 'report' } as ClinicScreen,
    },
  ];
  const stats = [
    ['Врачи', countActive(state.doctors)],
    ['Пациенты', countActive(state.patients)],
    ['Записи', countActive(state.appointments)],
    ['Проведено', state.receptions.filter((item) => item.posted && !item.marked).length],
  ] as const;
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <p className="max-w-prose text-sm leading-relaxed text-[#3d4b5c]">
        Заведите справочники, создайте запись на приём и проведите приём со списком услуг.
        Проведение заполняет регистр загруженности врачей. Демобаза уже содержит два приёма из
        итогового проекта.
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#e4d8c6] bg-[#fffdf8] px-3 py-2">
            <dt className="text-xs text-[#5c6b7a]">{label}</dt>
            <dd className="text-lg font-semibold text-[#2c3848]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onOpen(card.screen)}
            className="min-h-[var(--tap)] rounded-md border border-[#e4d8c6] bg-white px-3 py-3 text-left hover:border-[#c9890a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9890a]"
          >
            <span className="block text-sm font-semibold text-[#2c3848]">{card.title}</span>
            <span className="mt-1 block text-sm text-[#5c6b7a]">{card.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ListView = ({
  state,
  object,
  query,
  showMarked,
  onQuery,
  onShowMarked,
  onOpen,
}: {
  state: ClinicState;
  object: ListObject;
  query: string;
  showMarked: boolean;
  onQuery: (value: string) => void;
  onShowMarked: (value: boolean) => void;
  onOpen: (screen: ClinicScreen) => void;
}) => {
  const rows = useMemo(() => rowsOf(state, object), [state, object]);
  const needle = query.trim().toLocaleLowerCase('ru');
  const visible = rows.filter((row) => {
    if (!showMarked && row.marked) return false;
    if (needle.length === 0) return true;
    return row.cells.join(' ').toLocaleLowerCase('ru').includes(needle);
  });
  const wide = LIST_HEADERS[object].length > 2;
  const showMarkedId = useId();
  return (
    <div>
      <PanelTitle title={LIST_TITLES[object]} meta={String(visible.length)} />
      <CommandBar>
        <ActionButton tone="primary" onClick={() => onOpen(openCreated(object))}>
          Создать
        </ActionButton>
        <label
          htmlFor={showMarkedId}
          className="flex min-h-[var(--tap)] items-center gap-2 text-sm text-[#3d4b5c]"
        >
          <input
            id={showMarkedId}
            type="checkbox"
            className="size-4"
            checked={showMarked}
            onChange={(event) => onShowMarked(event.target.checked)}
          />
          Показывать помеченные
        </label>
        <input
          className={cx(fieldClass, 'sm:max-w-xs')}
          value={query}
          placeholder="Найти"
          aria-label="Поиск в списке"
          onChange={(event) => onQuery(event.target.value)}
        />
      </CommandBar>
      {visible.length === 0 ? (
        <p className="p-4 text-sm text-[#5c6b7a]">
          {rows.length === 0 ? 'Список пуст. Нажмите «Создать».' : 'Ничего не найдено.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className={cx('w-full border-collapse text-left text-sm', wide && 'min-w-[52rem]')}
          >
            <caption className="sr-only">{LIST_TITLES[object]}</caption>
            <thead>
              <tr className="text-xs font-medium text-[#5c6b7a]">
                {LIST_HEADERS[object].map((title) => (
                  <th key={title} className="px-3 py-2 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={cx(
                    'border-t border-[#e4d8c6]',
                    row.marked && 'text-[#8a8175] line-through',
                  )}
                >
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${index}`} className="px-3 py-1">
                      {index === 0 ? (
                        <button
                          type="button"
                          className="min-h-[var(--tap)] text-left font-medium text-[#2c3848] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9890a]"
                          onClick={() => onOpen(openExisting(object, row.id))}
                        >
                          {cell}
                          {row.marked ? ' (удалён)' : ''}
                        </button>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ClinicApp = () => {
  const [state, setState] = useState<ClinicState | null>(null);
  const [screen, setScreen] = useState<ClinicScreen>({ kind: 'home' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showMarked, setShowMarked] = useState(false);
  const ready = useRef(false);
  const section = sectionOf(screen);
  const sectionId = useId();

  useEffect(() => {
    let cancelled = false;
    loadClinicState()
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch(() => {
        if (!cancelled) setState(demoClinic());
      })
      .finally(() => {
        if (!cancelled) ready.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready.current || !state) return;
    void saveClinicState(state);
  }, [state]);

  useEffect(() => {
    setQuery('');
  }, [section]);

  const open = (next: ClinicScreen): void => {
    setError(null);
    setNotice(null);
    setScreen(next);
  };

  const replaceBase = (next: ClinicState, question: string): void => {
    if (!window.confirm(question)) return;
    setState(next);
    setError(null);
    setNotice('База заменена');
    setScreen({ kind: 'home' });
  };

  if (!state) return <Skeleton rounded="xl" className="h-[36rem]" />;

  const editor = {
    state,
    onState: setState,
    onError: setError,
    onNotice: setNotice,
    onOpen: open,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#d7cbb8] bg-[#f6f1e8] text-[#1c2430] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#2c3848] px-3 py-2.5 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Учёт пациентов и приёмов</p>
          <p className="truncate text-[11px] text-white/70">
            частная клиника, учебная база в браузере
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-[var(--tap)] rounded-md bg-white/10 px-3 text-xs hover:bg-white/20"
            onClick={() =>
              replaceBase(demoClinic(), 'Заменить текущую базу демонстрационными данными проекта?')
            }
          >
            Демоданные
          </button>
          <button
            type="button"
            className="min-h-[var(--tap)] rounded-md bg-white/10 px-3 text-xs hover:bg-white/20"
            onClick={() =>
              replaceBase(emptyClinic(), 'Очистить базу? Текущие записи будут стёрты.')
            }
          >
            Пустая база
          </button>
        </div>
      </div>

      <div className="border-b border-[#e4d8c6] bg-[#fffdf8] p-2 md:hidden">
        <label
          htmlFor={sectionId}
          className="flex flex-col gap-1 text-xs font-medium text-[#5c6b7a]"
        >
          Раздел
          <select
            id={sectionId}
            className={fieldClass}
            value={section}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'home') {
                open({ kind: 'home' });
                return;
              }
              const item = NAV.flatMap((group) => group.items).find((entry) => entry.id === next);
              if (item) open(item.screen);
            }}
          >
            <option value="home">Начальная страница</option>
            {NAV.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="md:flex md:min-h-[36rem]">
        <nav
          aria-label="Разделы базы"
          className="hidden w-60 shrink-0 flex-col gap-4 border-r border-[#e4d8c6] bg-[#f6f1e8] p-3 md:flex"
        >
          <button
            type="button"
            onClick={() => open({ kind: 'home' })}
            className={cx(
              'min-h-[var(--tap)] rounded-md px-3 text-left text-sm',
              section === 'home'
                ? 'bg-white font-semibold text-[#2c3848]'
                : 'text-[#3d4b5c] hover:bg-white/70',
            )}
          >
            Начальная страница
          </button>
          {NAV.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[#8a8175]">
                {group.title}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => open(item.screen)}
                  className={cx(
                    'min-h-[var(--tap)] w-full rounded-md px-3 text-left text-sm',
                    section === item.id
                      ? 'bg-white font-semibold text-[#2c3848]'
                      : 'text-[#3d4b5c] hover:bg-white/70',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1 bg-white">
          {error ? (
            <p role="alert" className="bg-[#fdeceb] px-3 py-2 text-sm text-[#8c3a2f]">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="bg-[#e7f2e4] px-3 py-2 text-sm text-[#245c32]">{notice}</p>
          ) : null}
          {screen.kind === 'home' ? <HomeView state={state} onOpen={open} /> : null}
          {screen.kind === 'list' ? (
            <ListView
              state={state}
              object={screen.object}
              query={query}
              showMarked={showMarked}
              onQuery={setQuery}
              onShowMarked={setShowMarked}
              onOpen={open}
            />
          ) : null}
          {screen.kind === 'person' ? (
            <PersonForm
              key={`${screen.catalog}-${screen.id ?? 'new'}`}
              {...editor}
              catalog={screen.catalog}
              recordId={screen.id}
            />
          ) : null}
          {screen.kind === 'named' ? (
            <NamedForm
              key={`${screen.catalog}-${screen.id ?? 'new'}`}
              {...editor}
              catalog={screen.catalog}
              recordId={screen.id}
            />
          ) : null}
          {screen.kind === 'appointment' ? (
            <AppointmentForm key={screen.id ?? 'new'} {...editor} recordId={screen.id} />
          ) : null}
          {screen.kind === 'reception' ? (
            <ReceptionForm
              key={`${screen.id ?? 'new'}-${screen.fromAppointmentId ?? ''}`}
              {...editor}
              recordId={screen.id}
              fromAppointmentId={screen.fromAppointmentId}
            />
          ) : null}
          {screen.kind === 'register' ? <RegisterView state={state} /> : null}
          {screen.kind === 'report' ? <ReportView state={state} onOpen={open} /> : null}
          {screen.kind === 'chart' ? <ChartView state={state} onOpen={open} /> : null}
        </div>
      </div>
    </div>
  );
};
