import { doctorLoad, workloadTable, type ClinicState } from '@dotlearn/lesson-engine/clinic';

import { ActionButton, CommandBar, PanelTitle } from '@/components/clinic/chrome';
import { standTableClass, standTableLaterClass } from '@/components/onec/stand-layout';
import { doctorName, formatNumber, formatStamp, serviceName } from '@/components/clinic/format';
import { registerScreen, type ClinicScreen } from '@/components/clinic/screen';

const EmptyNote = ({ text }: { text: string }) => (
  <p className="p-4 text-sm text-[#5c6b7a]">{text}</p>
);

export const RegisterView = ({
  state,
  registrarId,
  onOpen,
}: {
  state: ClinicState;
  registrarId: string | null;
  onOpen: (screen: ClinicScreen) => void;
}) => {
  const reception = registrarId
    ? state.receptions.find((item) => item.id === registrarId)
    : undefined;
  const rows = state.movements
    .filter((row) => registrarId === null || row.registrarId === registrarId)
    .sort(
      (left, right) => right.period.localeCompare(left.period) || right.id.localeCompare(left.id),
    );
  return (
    <div>
      <PanelTitle
        title="Загруженность врачей"
        meta={reception ? `приём №${reception.number}` : 'все движения'}
      />
      {registrarId ? (
        <CommandBar>
          <ActionButton onClick={() => onOpen(registerScreen(null))}>Все движения</ActionButton>
        </CommandBar>
      ) : null}
      {rows.length === 0 ? (
        <EmptyNote text="Движений нет. Проведите приём пациента, и строки появятся здесь." />
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className={`${standTableClass} text-sm`}>
            <caption className="sr-only">Движения регистра загруженности врачей</caption>
            <thead>
              <tr className="text-xs font-medium text-[#5c6b7a]">
                {['Период', 'Приём', 'Врач', 'Услуга', 'Количество', 'Выручка', 'Длительность'].map(
                  (title, index) => (
                    <th
                      key={title}
                      className={
                        index > 2
                          ? `px-3 py-2 font-medium ${standTableLaterClass}`
                          : 'px-3 py-2 font-medium'
                      }
                    >
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const registrar = state.receptions.find((item) => item.id === row.registrarId);
                return (
                  <tr key={row.id} className="border-t border-[#e4d8c6]">
                    <td className="px-3 py-2">{formatStamp(row.period)}</td>
                    <td className="px-3 py-2">
                      {registrar ? `№${registrar.number}` : 'не найден'}
                    </td>
                    <td className="px-3 py-2">{doctorName(state, row.doctorId)}</td>
                    <td className={`px-3 py-2 ${standTableLaterClass}`}>
                      {serviceName(state, row.serviceId)}
                    </td>
                    <td className={`px-3 py-2 ${standTableLaterClass}`}>
                      {formatNumber(row.count)}
                    </td>
                    <td className={`px-3 py-2 ${standTableLaterClass}`}>
                      {formatNumber(row.revenue)}
                    </td>
                    <td className={`px-3 py-2 ${standTableLaterClass}`}>
                      {formatNumber(row.duration)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ReportView = ({
  state,
  onOpen,
}: {
  state: ClinicState;
  onOpen: (screen: ClinicScreen) => void;
}) => {
  const rows = workloadTable(state)
    .map((row) => ({
      ...row,
      doctor: doctorName(state, row.doctorId),
      service: serviceName(state, row.serviceId),
    }))
    .sort(
      (left, right) =>
        left.doctor.localeCompare(right.doctor, 'ru') ||
        left.service.localeCompare(right.service, 'ru'),
    );
  return (
    <div>
      <PanelTitle title="Загруженность врачей" meta="таблица" />
      <CommandBar>
        <ActionButton tone="primary" onClick={() => onOpen({ kind: 'chart' })}>
          Открыть график
        </ActionButton>
      </CommandBar>
      {rows.length === 0 ? (
        <EmptyNote text="Отчёт пуст, пока нет проведённых приёмов." />
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className={`${standTableClass} text-sm`}>
            <caption className="sr-only">Отчёт по загруженности врачей</caption>
            <thead>
              <tr className="text-xs font-medium text-[#5c6b7a]">
                {['Врач', 'Услуга', 'Количество приёмов', 'Выручка', 'Длительность, мин'].map(
                  (title, index) => (
                    <th
                      key={title}
                      className={
                        index > 2
                          ? `px-3 py-2 font-medium ${standTableLaterClass}`
                          : 'px-3 py-2 font-medium'
                      }
                    >
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.doctorId}-${row.serviceId}`} className="border-t border-[#e4d8c6]">
                  <td className="px-3 py-2">{row.doctor}</td>
                  <td className="px-3 py-2">{row.service}</td>
                  <td className="px-3 py-2">{formatNumber(row.count)}</td>
                  <td className={`px-3 py-2 ${standTableLaterClass}`}>
                    {formatNumber(row.revenue)}
                  </td>
                  <td className={`px-3 py-2 ${standTableLaterClass}`}>
                    {formatNumber(row.duration)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#d7cbb8] font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Итого
                </td>
                <td className="px-3 py-2">
                  {formatNumber(rows.reduce((sum, row) => sum + row.count, 0))}
                </td>
                <td className={`px-3 py-2 ${standTableLaterClass}`}>
                  {formatNumber(rows.reduce((sum, row) => sum + row.revenue, 0))}
                </td>
                <td className={`px-3 py-2 ${standTableLaterClass}`}>
                  {formatNumber(rows.reduce((sum, row) => sum + row.duration, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const chartMetrics = [
  {
    title: 'Количество приёмов',
    color: '#c9890a',
    pick: (row: { count: number }) => row.count,
  },
  {
    title: 'Длительность, мин',
    color: '#2c3848',
    pick: (row: { duration: number }) => row.duration,
  },
  {
    title: 'Выручка',
    color: '#3f6b4e',
    pick: (row: { revenue: number }) => row.revenue,
  },
] as const;

export const ChartView = ({
  state,
  onOpen,
}: {
  state: ClinicState;
  onOpen: (screen: ClinicScreen) => void;
}) => {
  const rows = doctorLoad(state).map((row) => ({
    ...row,
    name: doctorName(state, row.doctorId),
  }));
  return (
    <div>
      <PanelTitle title="Загруженность врачей" meta="график" />
      <CommandBar>
        <ActionButton onClick={() => onOpen({ kind: 'report' })}>Открыть таблицу</ActionButton>
      </CommandBar>
      {rows.length === 0 ? (
        <EmptyNote text="График появится после проведения приёма." />
      ) : (
        <div className="space-y-4 p-3">
          <ul className="flex flex-wrap gap-3 text-xs text-[#5c6b7a]">
            {chartMetrics.map((metric) => (
              <li key={metric.title} className="inline-flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ backgroundColor: metric.color }}
                />
                {metric.title}
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 items-end gap-6 overflow-x-auto pb-2">
            {rows.map((row) => (
              <div key={row.doctorId} className="flex min-w-28 flex-col items-center">
                <div className="flex h-48 items-end gap-1">
                  {chartMetrics.map((metric) => {
                    const value = metric.pick(row);
                    const max = Math.max(...rows.map((item) => metric.pick(item)), 1);
                    return (
                      <div
                        key={metric.title}
                        className="flex w-8 flex-col items-center justify-end"
                      >
                        <span className="mb-1 text-[10px] tabular-nums text-[#5c6b7a]">
                          {formatNumber(value)}
                        </span>
                        <div
                          className="w-6 rounded-t"
                          style={{
                            height: `${Math.max(4, (value / max) * 140)}px`,
                            backgroundColor: metric.color,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 max-w-28 truncate text-center text-xs text-[#2c3848]">
                  {row.name}
                </p>
              </div>
            ))}
          </div>
          <p className="max-w-prose text-xs leading-relaxed text-[#5c6b7a]">
            По оси врача три показателя из отчёта проекта. Высота каждого цвета считается по своему
            максимуму, рядом написано само число. Каждая строка услуг проведённого приёма даёт одно
            движение.
          </p>
        </div>
      )}
    </div>
  );
};
