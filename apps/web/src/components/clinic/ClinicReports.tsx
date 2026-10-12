import { doctorLoad, workloadTable, type ClinicState } from '@dotlearn/lesson-engine';

import { ActionButton, CommandBar, PanelTitle } from '@/components/clinic/chrome';
import { doctorName, formatNumber, formatStamp, serviceName } from '@/components/clinic/format';
import type { ClinicScreen } from '@/components/clinic/screen';

const EmptyNote = ({ text }: { text: string }) => (
  <p className="p-4 text-sm text-[#5c6b7a]">{text}</p>
);

export const RegisterView = ({ state }: { state: ClinicState }) => {
  const rows = [...state.movements].sort(
    (left, right) => right.period.localeCompare(left.period) || right.id.localeCompare(left.id),
  );
  return (
    <div>
      <PanelTitle title="Загруженность врачей" meta="движения регистра" />
      {rows.length === 0 ? (
        <EmptyNote text="Движений нет. Проведите приём пациента, и строки появятся здесь." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">Движения регистра загруженности врачей</caption>
            <thead>
              <tr className="text-xs font-medium text-[#5c6b7a]">
                {['Период', 'Приём', 'Врач', 'Услуга', 'Количество', 'Выручка', 'Длительность'].map(
                  (title) => (
                    <th key={title} className="px-3 py-2 font-medium">
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const reception = state.receptions.find((item) => item.id === row.registrarId);
                return (
                  <tr key={row.id} className="border-t border-[#e4d8c6]">
                    <td className="px-3 py-2">{formatStamp(row.period)}</td>
                    <td className="px-3 py-2">
                      {reception ? `№${reception.number}` : 'не найден'}
                    </td>
                    <td className="px-3 py-2">{doctorName(state, row.doctorId)}</td>
                    <td className="px-3 py-2">{serviceName(state, row.serviceId)}</td>
                    <td className="px-3 py-2">{formatNumber(row.count)}</td>
                    <td className="px-3 py-2">{formatNumber(row.revenue)}</td>
                    <td className="px-3 py-2">{formatNumber(row.duration)}</td>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Отчёт по загруженности врачей</caption>
            <thead>
              <tr className="text-xs font-medium text-[#5c6b7a]">
                {['Врач', 'Услуга', 'Количество приёмов', 'Выручка', 'Длительность, мин'].map(
                  (title) => (
                    <th key={title} className="px-3 py-2 font-medium">
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
                  <td className="px-3 py-2">{formatNumber(row.revenue)}</td>
                  <td className="px-3 py-2">{formatNumber(row.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const chartMetrics = [
  { title: 'Количество приёмов', pick: (row: { count: number }) => row.count },
  { title: 'Длительность, мин', pick: (row: { duration: number }) => row.duration },
  { title: 'Выручка', pick: (row: { revenue: number }) => row.revenue },
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
        <div className="space-y-6 p-3">
          {chartMetrics.map((metric) => {
            const max = Math.max(...rows.map((row) => metric.pick(row)), 1);
            return (
              <section key={metric.title} aria-label={metric.title}>
                <h3 className="mb-2 text-sm font-semibold text-[#2c3848]">{metric.title}</h3>
                <ul className="space-y-3">
                  {rows.map((row) => {
                    const value = metric.pick(row);
                    return (
                      <li key={row.doctorId}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span>{row.name}</span>
                          <span className="tabular-nums text-[#5c6b7a]">{formatNumber(value)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-[#f6f1e8]">
                          <div
                            className="h-3 rounded-full bg-[#c9890a]"
                            style={{ width: `${Math.max(0, (value / max) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="max-w-prose text-xs leading-relaxed text-[#5c6b7a]">
            Показатели совпадают с отчётом проекта: врач и три меры. Каждая строка услуг
            проведённого приёма пишет одно движение, длительность приёма копируется в каждую строку.
          </p>
        </div>
      )}
    </div>
  );
};
