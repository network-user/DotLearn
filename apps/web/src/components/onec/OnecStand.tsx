import { useEffect, useMemo, useState } from 'react';

import type {
  OnecCatalog,
  OnecCommand,
  OnecFocus,
  OnecList,
  OnecSection,
  OnecSeed,
} from '@dotlearn/contracts';
import {
  applyOnecCommand,
  draftReceipt,
  onecBalances,
  OnecCommandError,
  replayOnec,
} from '@dotlearn/lesson-engine';
import { BarChart3, BookOpen, FileText, FolderTree, Home } from 'lucide-react';

import { cx } from '@/components/ui/cx';

interface OnecStandProps {
  seed: OnecSeed;
  commands: readonly OnecCommand[];
  onChange: (commands: OnecCommand[]) => void;
  focus?: OnecFocus | undefined;
  locked?: boolean;
}

const SECTIONS: { id: OnecSection; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Главное', icon: Home },
  { id: 'catalogs', label: 'Справочники', icon: BookOpen },
  { id: 'documents', label: 'Документы', icon: FileText },
  { id: 'reports', label: 'Отчёты', icon: BarChart3 },
  { id: 'config', label: 'Конфигурация', icon: FolderTree },
];

const CATALOGS: { id: OnecCatalog; label: string }[] = [
  { id: 'counterparties', label: 'Контрагенты' },
  { id: 'products', label: 'Номенклатура' },
  { id: 'warehouses', label: 'Склады' },
];

const formatDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
};

const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

const fieldClass =
  'h-11 w-full rounded-md border border-[#d7cbb8] bg-white px-3 text-[16px] text-[#1c2430] sm:h-9 sm:text-sm';

export const OnecStand = ({ seed, commands, onChange, focus, locked = false }: OnecStandProps) => {
  const state = useMemo(() => replayOnec(seed, commands), [seed, commands]);
  const [banner, setBanner] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [lineProduct, setLineProduct] = useState('');
  const [lineQty, setLineQty] = useState('10');
  const [linePrice, setLinePrice] = useState('100');
  const [showMoves, setShowMoves] = useState(false);
  const [queryText, setQueryText] = useState('ВЫБРАТЬ Номенклатура, Склад, Количество\nИЗ Остатки');

  useEffect(() => {
    setBanner(null);
    setCreating(false);
    setShowMoves(false);
    setCatalogName('');
  }, [seed, commands.length]);

  const send = (command: OnecCommand): boolean => {
    if (locked) return false;
    try {
      applyOnecCommand(state, command);
      onChange([...commands, command]);
      setBanner(null);
      return true;
    } catch (error) {
      setBanner(error instanceof OnecCommandError ? error.message : 'Команда не выполнилась');
      return false;
    }
  };

  const mark = (token: OnecFocus): string =>
    focus === token ? 'ring-2 ring-[#c9890a] ring-offset-2 ring-offset-[#f6f1e8]' : '';

  const receipt = draftReceipt(state);
  const draft = state.ui.draft;
  const balances = onecBalances(state);

  const openCatalog = (object: OnecList): void => {
    setCreating(false);
    send({ op: 'open-list', object });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#d7cbb8] bg-[#f6f1e8] text-[#1c2430] shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-[#2c3848] px-3 py-2.5 text-white sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Учебный стенд</p>
          <p className="truncate text-[11px] text-white/70">тренажёр учёта, не программа 1С</p>
        </div>
        <p className="hidden text-[11px] text-white/70 sm:block">{formatDate(state.today)}</p>
      </div>

      <div
        className={cx(
          'flex gap-1 overflow-x-auto border-b border-[#e4d8c6] bg-white px-1',
          mark('sections'),
        )}
        role="tablist"
        aria-label="Разделы"
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = state.ui.section === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => send({ op: 'open-section', section: section.id })}
              className={cx(
                'flex min-h-11 min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-[11px]',
                active
                  ? 'border-b-2 border-[#c9890a] font-semibold text-[#2c3848]'
                  : 'border-b-2 border-transparent text-[#5c6b7a]',
              )}
            >
              <Icon size={16} aria-hidden />
              {section.label}
            </button>
          );
        })}
      </div>

      {state.ui.section === 'catalogs' ? (
        <div
          className={cx(
            'flex gap-1 overflow-x-auto border-b border-[#e4d8c6] bg-[#fffdf8] px-2 py-1',
            mark('catalog-nav'),
          )}
        >
          {CATALOGS.map((catalog) => (
            <button
              key={catalog.id}
              type="button"
              onClick={() => openCatalog(catalog.id)}
              className={cx(
                'min-h-11 shrink-0 rounded-md px-3 text-sm',
                state.ui.list === catalog.id
                  ? 'bg-[#2c3848] text-white'
                  : 'text-[#2c3848] hover:bg-[#f3eadb]',
              )}
            >
              {catalog.label}
            </button>
          ))}
        </div>
      ) : null}

      {state.ui.section === 'documents' ? (
        <div
          className={cx(
            'flex gap-1 border-b border-[#e4d8c6] bg-[#fffdf8] px-2 py-1',
            mark('document-nav'),
          )}
        >
          <button
            type="button"
            onClick={() => openCatalog('receipts')}
            className={cx(
              'min-h-11 rounded-md px-3 text-sm',
              state.ui.list === 'receipts'
                ? 'bg-[#2c3848] text-white'
                : 'text-[#2c3848] hover:bg-[#f3eadb]',
            )}
          >
            Поступление товаров
          </button>
          <button
            type="button"
            onClick={() => openCatalog('sales')}
            className={cx(
              'min-h-11 rounded-md px-3 text-sm',
              state.ui.list === 'sales'
                ? 'bg-[#2c3848] text-white'
                : 'text-[#2c3848] hover:bg-[#f3eadb]',
              focus === 'sale-create' && 'ring-2 ring-[#c9890a] ring-offset-2',
            )}
          >
            Реализация товаров
          </button>
        </div>
      ) : null}

      {state.ui.section === 'reports' ? (
        <div
          className={cx(
            'flex gap-1 border-b border-[#e4d8c6] bg-[#fffdf8] px-2 py-1',
            mark('report-nav'),
          )}
        >
          <button
            type="button"
            onClick={() => openCatalog('balances')}
            className={cx(
              'min-h-11 rounded-md px-3 text-sm',
              state.ui.list === 'balances'
                ? 'bg-[#2c3848] text-white'
                : 'text-[#2c3848] hover:bg-[#f3eadb]',
            )}
          >
            Остатки товаров
          </button>
        </div>
      ) : null}

      <div className="min-h-[22rem] bg-[#fbf8f2] p-3 sm:p-4">
        {banner ? (
          <p
            className="mb-3 rounded-md border border-[#e7b4a0] bg-[#fff1ec] px-3 py-2 text-sm text-[#8a341c]"
            role="alert"
          >
            {banner}
          </p>
        ) : null}

        {state.ui.section === 'home' ? <HomePane /> : null}

        {state.ui.list &&
        (state.ui.list === 'counterparties' ||
          state.ui.list === 'products' ||
          state.ui.list === 'warehouses') &&
        !draft ? (
          <CatalogPane
            title={CATALOGS.find((item) => item.id === state.ui.list)?.label ?? 'Справочник'}
            rows={state[state.ui.list]}
            highlightMark={focus === 'mark'}
            onToggleMark={(name) => {
              const catalog = state.ui.list;
              if (
                catalog !== 'counterparties' &&
                catalog !== 'products' &&
                catalog !== 'warehouses'
              ) {
                return;
              }
              send({ op: 'toggle-mark-catalog', catalog, name });
            }}
            creating={creating}
            name={catalogName}
            highlightCreate={focus === 'counterparty-create' && state.ui.list === 'counterparties'}
            onStartCreate={() => setCreating(true)}
            onName={setCatalogName}
            onCancel={() => {
              setCreating(false);
              setCatalogName('');
            }}
            onSave={() => {
              const catalog = state.ui.list;
              if (
                catalog !== 'counterparties' &&
                catalog !== 'products' &&
                catalog !== 'warehouses'
              ) {
                return;
              }
              if (!send({ op: 'create-catalog', catalog, name: catalogName })) return;
              setCatalogName('');
              setCreating(false);
            }}
          />
        ) : null}

        {state.ui.list === 'receipts' && !draft ? (
          <ReceiptList
            title="Поступление товаров"
            rows={state.receipts}
            highlightCreate={focus === 'receipt-create'}
            onCreate={() => send({ op: 'open-new-receipt' })}
            onOpen={(id) => send({ op: 'open-receipt', id })}
          />
        ) : null}

        {state.ui.list === 'sales' && !draft ? (
          <ReceiptList
            title="Реализация товаров"
            rows={state.sales}
            highlightCreate={focus === 'sale-create'}
            onCreate={() => send({ op: 'open-new-sale' })}
            onOpen={(id) => send({ op: 'open-sale', id })}
          />
        ) : null}

        {draft ? (
          <ReceiptForm
            title={draft.kind === 'sale' ? 'Реализация товаров' : 'Поступление товаров'}
            draft={draft}
            posted={receipt?.posted ?? false}
            marked={receipt?.deletionMark ?? false}
            counterparties={state.counterparties}
            warehouses={state.warehouses}
            products={state.products}
            lineProduct={lineProduct}
            lineQty={lineQty}
            linePrice={linePrice}
            showMoves={showMoves}
            warehouseName={draft.warehouseName}
            highlightFields={focus === 'receipt-fields'}
            highlightPost={focus === 'post'}
            onField={(field, value) =>
              send(
                draft.kind === 'sale'
                  ? { op: 'set-sale-field', field, value }
                  : { op: 'set-receipt-field', field, value },
              )
            }
            onLineProduct={setLineProduct}
            onLineQty={setLineQty}
            onLinePrice={setLinePrice}
            onAddLine={() => {
              const qty = Number(lineQty.replace(',', '.'));
              const price = Number(linePrice.replace(',', '.'));
              if (
                !lineProduct ||
                !Number.isFinite(qty) ||
                qty <= 0 ||
                !Number.isFinite(price) ||
                price < 0
              ) {
                setBanner('Проверьте номенклатуру, количество и цену');
                return;
              }
              send(
                draft.kind === 'sale'
                  ? { op: 'add-sale-line', product: lineProduct, qty, price }
                  : { op: 'add-receipt-line', product: lineProduct, qty, price },
              );
            }}
            onRemoveLine={(index) =>
              send(
                draft.kind === 'sale'
                  ? { op: 'remove-sale-line', index }
                  : { op: 'remove-receipt-line', index },
              )
            }
            onPost={() =>
              send(draft.kind === 'sale' ? { op: 'post-sale' } : { op: 'post-receipt' })
            }
            onSave={() =>
              send(draft.kind === 'sale' ? { op: 'save-sale' } : { op: 'save-receipt' })
            }
            onUnpost={() =>
              send(draft.kind === 'sale' ? { op: 'unpost-sale' } : { op: 'unpost-receipt' })
            }
            onMark={() => send({ op: 'toggle-mark-doc' })}
            highlightMark={focus === 'mark'}
            onClose={() => {
              setShowMoves(false);
              send({ op: 'close-form' });
            }}
            onToggleMoves={() => setShowMoves((value) => !value)}
          />
        ) : null}

        {state.ui.list === 'balances' && !draft ? (
          <div className="space-y-4">
            <BalancePane rows={balances} />
            <QueryPane
              text={queryText}
              rows={state.lastQuery?.rows}
              highlight={focus === 'query'}
              onText={setQueryText}
              onRun={() => send({ op: 'run-query', text: queryText })}
            />
          </div>
        ) : null}

        {state.ui.section === 'config' && !draft ? (
          <div className={cx('space-y-4', mark('metadata'))}>
            <ConfigPane />
            <QueryPane
              text={queryText}
              rows={state.lastQuery?.rows}
              highlight={focus === 'query'}
              onText={setQueryText}
              onRun={() => send({ op: 'run-query', text: queryText })}
            />
          </div>
        ) : null}

        {state.ui.section !== 'home' &&
        state.ui.section !== 'config' &&
        !state.ui.list &&
        !draft ? (
          <p className="text-sm text-[#5c6b7a]">
            Выберите команду раздела. Она откроет список или отчёт.
          </p>
        ) : null}
      </div>
    </div>
  );
};

const HomePane = () => (
  <div className="grid gap-3 md:grid-cols-3">
    <InfoCard
      title="Панель разделов"
      text="Верхняя полоса переключает область: справочники, документы или отчёты. В рабочей программе разделы другие, схема та же."
    />
    <InfoCard
      title="Команды раздела"
      text="Под разделами лежат списки. Контрагент и номенклатура живут в справочниках, событие закупки - в документе."
    />
    <InfoCard
      title="Проведение"
      text="Проведение пишет движения. Реализация списывает остаток и не пройдёт, если товара не хватает. Черновик и пометка удаления остаток не меняют."
    />
  </div>
);

const InfoCard = ({ title, text }: { title: string; text: string }) => (
  <article className="rounded-lg border border-[#e4d8c6] bg-white p-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-[#3d4b5c]">{text}</p>
  </article>
);

const CatalogPane = ({
  title,
  rows,
  creating,
  name,
  highlightCreate,
  highlightMark,
  onStartCreate,
  onName,
  onCancel,
  onSave,
  onToggleMark,
}: {
  title: string;
  rows: { id: string; code: string; name: string; deletionMark: boolean }[];
  creating: boolean;
  name: string;
  highlightCreate: boolean;
  highlightMark: boolean;
  onStartCreate: () => void;
  onName: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onToggleMark: (name: string) => void;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onStartCreate}
        className={cx(
          'min-h-11 rounded-md bg-[#c9890a] px-4 text-sm font-semibold text-[#1c2430]',
          highlightCreate && 'ring-2 ring-[#2c3848] ring-offset-2',
        )}
      >
        Создать
      </button>
    </div>
    {creating ? (
      <form
        className="grid gap-2 rounded-lg border border-[#e4d8c6] bg-white p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-[#5c6b7a]">Наименование</span>
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-[#2c3848] px-4 text-sm font-semibold text-white"
        >
          Записать и закрыть
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-md px-3 text-sm text-[#5c6b7a]"
        >
          Отмена
        </button>
      </form>
    ) : null}
    <div className="overflow-x-auto rounded-lg border border-[#e4d8c6] bg-white">
      <table className="w-full min-w-[18rem] text-left text-sm">
        <thead className="border-b border-[#e4d8c6] text-[#5c6b7a]">
          <tr>
            <th className="px-3 py-2 font-medium">Наименование</th>
            <th className="px-3 py-2 font-medium">Код</th>
            <th className="px-3 py-2 font-medium">Пометка</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-[#5c6b7a]" colSpan={3}>
                Список пуст
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f0e6d6] last:border-0">
                <td className={cx('px-3 py-2', row.deletionMark && 'line-through text-[#8a341c]')}>
                  {row.name}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.code}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className={cx(
                      'min-h-11 text-sm text-[#5c6b7a]',
                      highlightMark && 'ring-2 ring-[#c9890a]',
                    )}
                    onClick={() => onToggleMark(row.name)}
                  >
                    {row.deletionMark ? 'Снять пометку' : 'Пометить'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ReceiptList = ({
  title,
  rows,
  highlightCreate,
  onCreate,
  onOpen,
}: {
  title: string;
  rows: {
    id: string;
    number: string;
    date: string;
    counterpartyName: string;
    posted: boolean;
    deletionMark: boolean;
  }[];
  highlightCreate: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onCreate}
        className={cx(
          'min-h-11 rounded-md bg-[#c9890a] px-4 text-sm font-semibold text-[#1c2430]',
          highlightCreate && 'ring-2 ring-[#2c3848] ring-offset-2',
        )}
      >
        Создать
      </button>
    </div>
    <div className="overflow-x-auto rounded-lg border border-[#e4d8c6] bg-white">
      <table className="w-full min-w-[22rem] text-left text-sm">
        <thead className="border-b border-[#e4d8c6] text-[#5c6b7a]">
          <tr>
            <th className="px-3 py-2 font-medium">Номер</th>
            <th className="px-3 py-2 font-medium">Дата</th>
            <th className="px-3 py-2 font-medium">Контрагент</th>
            <th className="px-3 py-2 font-medium">Состояние</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-[#5c6b7a]" colSpan={4}>
                Документов нет
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f0e6d6] last:border-0">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="min-h-11 underline-offset-2 hover:underline"
                    onClick={() => onOpen(row.id)}
                  >
                    {row.number}
                  </button>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatDate(row.date)}</td>
                <td className="px-3 py-2">{row.counterpartyName}</td>
                <td className="px-3 py-2">
                  {row.posted ? 'Проведен' : 'Записан'}
                  {row.deletionMark ? ', помечен' : ''}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ReceiptForm = ({
  title,
  draft,
  posted,
  marked,
  highlightMark,
  onMark,
  counterparties,
  warehouses,
  products,
  lineProduct,
  lineQty,
  linePrice,
  showMoves,
  warehouseName,
  highlightFields,
  highlightPost,
  onField,
  onLineProduct,
  onLineQty,
  onLinePrice,
  onAddLine,
  onRemoveLine,
  onPost,
  onSave,
  onUnpost,
  onClose,
  onToggleMoves,
}: {
  title: string;
  draft: {
    number: string;
    date: string;
    counterpartyName: string;
    warehouseName: string;
    lines: { productName: string; qty: number; price: number }[];
  };
  posted: boolean;
  marked: boolean;
  highlightMark: boolean;
  onMark: () => void;
  counterparties: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string }[];
  lineProduct: string;
  lineQty: string;
  linePrice: string;
  showMoves: boolean;
  warehouseName: string;
  highlightFields: boolean;
  highlightPost: boolean;
  onField: (field: 'counterparty' | 'warehouse', value: string) => void;
  onLineProduct: (value: string) => void;
  onLineQty: (value: string) => void;
  onLinePrice: (value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onPost: () => void;
  onSave: () => void;
  onUnpost: () => void;
  onClose: () => void;
  onToggleMoves: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="text-base font-semibold">
        {title} {draft.number} от {formatDate(draft.date)}
        {marked ? ' (пометка удаления)' : ''}
      </h2>
      <span className={cx('text-sm font-semibold', posted ? 'text-[#0f7a3a]' : 'text-[#5c6b7a]')}>
        {posted ? 'Проведен' : 'Не проведен'}
      </span>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPost}
        className={cx(
          'min-h-11 rounded-md bg-[#c9890a] px-4 text-sm font-semibold text-[#1c2430]',
          highlightPost && 'ring-2 ring-[#2c3848] ring-offset-2',
        )}
      >
        Провести
      </button>
      <button
        type="button"
        onClick={onSave}
        className="min-h-11 rounded-md border border-[#d7cbb8] bg-white px-4 text-sm"
      >
        Записать
      </button>
      <button
        type="button"
        onClick={onUnpost}
        className="min-h-11 rounded-md px-3 text-sm text-[#5c6b7a]"
      >
        Отмена проведения
      </button>
      <button
        type="button"
        onClick={onToggleMoves}
        className="min-h-11 rounded-md px-3 text-sm text-[#5c6b7a]"
      >
        Движения
      </button>
      <button
        type="button"
        onClick={onMark}
        className={cx(
          'min-h-11 rounded-md px-3 text-sm text-[#5c6b7a]',
          highlightMark && 'ring-2 ring-[#c9890a]',
        )}
      >
        {marked ? 'Снять пометку' : 'Пометить на удаление'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-md px-3 text-sm text-[#5c6b7a]"
      >
        Закрыть
      </button>
    </div>
    <div
      className={cx(
        'grid gap-3 rounded-lg border border-[#e4d8c6] bg-white p-3 sm:grid-cols-2',
        highlightFields && 'ring-2 ring-[#c9890a]',
      )}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-[#5c6b7a]">Контрагент</span>
        <select
          className={fieldClass}
          value={draft.counterpartyName}
          onChange={(event) => {
            if (event.target.value) onField('counterparty', event.target.value);
          }}
        >
          <option value="">Выберите</option>
          {counterparties.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#5c6b7a]">Склад</span>
        <select
          className={fieldClass}
          value={draft.warehouseName}
          onChange={(event) => {
            if (event.target.value) onField('warehouse', event.target.value);
          }}
        >
          <option value="">Выберите</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
    <div className="overflow-x-auto rounded-lg border border-[#e4d8c6] bg-white">
      <div className="border-b border-[#e4d8c6] px-3 py-2 text-sm font-semibold">Товары</div>
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="text-[#5c6b7a]">
          <tr>
            <th className="px-3 py-2 font-medium">Номенклатура</th>
            <th className="px-3 py-2 font-medium">Количество</th>
            <th className="px-3 py-2 font-medium">Цена</th>
            <th className="px-3 py-2 font-medium">Сумма</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Удалить</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line, index) => (
            <tr key={`${line.productName}-${index}`} className="border-t border-[#f0e6d6]">
              <td className="px-3 py-2">{line.productName}</td>
              <td className="px-3 py-2 tabular-nums">{formatQty(line.qty)}</td>
              <td className="px-3 py-2 tabular-nums">{formatQty(line.price)}</td>
              <td className="px-3 py-2 tabular-nums">{formatQty(line.qty * line.price)}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="min-h-11 text-[#8a341c]"
                  onClick={() => onRemoveLine(index)}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="grid gap-2 border-t border-[#e4d8c6] p-3 sm:grid-cols-[1.4fr_0.6fr_0.6fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onAddLine();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-[#5c6b7a]">Номенклатура</span>
          <select
            className={fieldClass}
            value={lineProduct}
            onChange={(event) => onLineProduct(event.target.value)}
          >
            <option value="">Выберите</option>
            {products.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#5c6b7a]">Количество</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={lineQty}
            onChange={(event) => onLineQty(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#5c6b7a]">Цена</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={linePrice}
            onChange={(event) => onLinePrice(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-[#2c3848] px-4 text-sm font-semibold text-white"
        >
          Добавить
        </button>
      </form>
    </div>
    {showMoves ? (
      <div className="overflow-x-auto rounded-lg border border-[#e4d8c6] bg-white">
        <div className="border-b border-[#e4d8c6] px-3 py-2 text-sm font-semibold">
          Движения: товары на складах
        </div>
        {posted ? (
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="text-[#5c6b7a]">
              <tr>
                <th className="px-3 py-2 font-medium">Вид</th>
                <th className="px-3 py-2 font-medium">Номенклатура</th>
                <th className="px-3 py-2 font-medium">Склад</th>
                <th className="px-3 py-2 font-medium">Количество</th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => (
                <tr key={`move-${index}`} className="border-t border-[#f0e6d6]">
                  <td className="px-3 py-2">
                    {title.startsWith('Реализация') ? 'Расход' : 'Приход'}
                  </td>
                  <td className="px-3 py-2">{line.productName}</td>
                  <td className="px-3 py-2">{warehouseName}</td>
                  <td className="px-3 py-2 tabular-nums">{formatQty(line.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-3 py-3 text-sm text-[#5c6b7a]">Движений нет: документ не проведён.</p>
        )}
      </div>
    ) : null}
  </div>
);

const BalancePane = ({
  rows,
}: {
  rows: { productName: string; warehouseName: string; qty: number; sum: number }[];
}) => (
  <div className="space-y-3">
    <h2 className="text-base font-semibold">Остатки товаров</h2>
    <div className="overflow-x-auto rounded-lg border border-[#e4d8c6] bg-white">
      <table className="w-full min-w-[22rem] text-left text-sm">
        <thead className="border-b border-[#e4d8c6] text-[#5c6b7a]">
          <tr>
            <th className="px-3 py-2 font-medium">Номенклатура</th>
            <th className="px-3 py-2 font-medium">Склад</th>
            <th className="px-3 py-2 font-medium">Количество</th>
            <th className="px-3 py-2 font-medium">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-[#5c6b7a]" colSpan={4}>
                Остатков нет. Проведите документ поступления.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={`${row.productName}-${row.warehouseName}`}
                className="border-b border-[#f0e6d6] last:border-0"
              >
                <td className="px-3 py-2">{row.productName}</td>
                <td className="px-3 py-2">{row.warehouseName}</td>
                <td className="px-3 py-2 tabular-nums">{formatQty(row.qty)}</td>
                <td className="px-3 py-2 tabular-nums">{formatQty(row.sum)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const QueryPane = ({
  text,
  rows,
  highlight,
  onText,
  onRun,
}: {
  text: string;
  rows: Record<string, string | number | boolean>[] | undefined;
  highlight: boolean;
  onText: (value: string) => void;
  onRun: () => void;
}) => {
  const columns = rows && rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  return (
    <form
      className={cx(
        'space-y-2 rounded-lg border border-[#e4d8c6] bg-white p-3',
        highlight && 'ring-2 ring-[#c9890a]',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <h2 className="text-base font-semibold">Консоль запроса</h2>
      <p className="text-sm text-[#5c6b7a]">
        ВЫБРАТЬ поля ИЗ Остатки, Поступления или Реализации. Одно условие: ГДЕ Поле =
        &quot;текст&quot;, число или Да/Нет.
      </p>
      <textarea
        value={text}
        onChange={(event) => onText(event.target.value)}
        rows={4}
        className="w-full rounded-md border border-[#d7cbb8] p-3 text-[16px] text-[#1c2430] sm:text-sm"
      />
      <button
        type="submit"
        className="min-h-11 rounded-md bg-[#2c3848] px-4 text-sm font-semibold text-white"
      >
        Выполнить
      </button>
      {rows ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-2 py-1 font-medium text-[#5c6b7a]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-[#5c6b7a]">Пустой результат</td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={index} className="border-t border-[#f0e6d6]">
                    {columns.map((column) => (
                      <td key={column} className="px-2 py-1">
                        {String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
};

const ConfigPane = () => (
  <div className="space-y-2 rounded-lg border border-[#e4d8c6] bg-white p-3 text-sm leading-relaxed">
    <h2 className="text-base font-semibold">Дерево, только чтение</h2>
    <p>Справочники: Контрагенты, Номенклатура, Склады.</p>
    <p>Документ «Поступление товаров» пишет приход в регистр «Товары на складах».</p>
    <p>Документ «Реализация товаров» пишет расход и не проводится, если остаток уйдёт ниже нуля.</p>
    <p>Пометка удаления не снимает проведение и не стирает движения.</p>
    <p>Отчёт и таблица Остатки читают только проведённые документы.</p>
  </div>
);
