import { useEffect, useMemo, useState, type ReactNode } from 'react';

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

import { cx } from '@/components/ui/cx';

interface OnecStandProps {
  seed: OnecSeed;
  commands: readonly OnecCommand[];
  onChange: (commands: OnecCommand[]) => void;
  focus?: OnecFocus | undefined;
  locked?: boolean;
}

type Spot =
  | 'sections'
  | 'section-home'
  | 'section-catalogs'
  | 'section-documents'
  | 'section-reports'
  | 'section-config'
  | 'function-panel'
  | 'fn-products'
  | 'fn-counterparties'
  | 'fn-warehouses'
  | 'fn-receipts'
  | 'fn-sales'
  | 'fn-balances'
  | 'create'
  | 'catalog-form'
  | 'doc-form'
  | 'fields'
  | 'post'
  | 'mark'
  | 'query'
  | 'metadata';

const SECTIONS: { id: OnecSection; label: string; spot: Spot; icon: IconName }[] = [
  { id: 'home', label: 'Главное', spot: 'section-home', icon: 'home' },
  { id: 'catalogs', label: 'Справочники', spot: 'section-catalogs', icon: 'book' },
  { id: 'documents', label: 'Документы', spot: 'section-documents', icon: 'doc' },
  { id: 'reports', label: 'Отчёты', spot: 'section-reports', icon: 'chart' },
  { id: 'config', label: 'Конфигурация', spot: 'section-config', icon: 'tree' },
];

const CATALOGS: { id: OnecCatalog; label: string; spot: Spot }[] = [
  { id: 'counterparties', label: 'Контрагенты', spot: 'fn-counterparties' },
  { id: 'products', label: 'Номенклатура', spot: 'fn-products' },
  { id: 'warehouses', label: 'Склады', spot: 'fn-warehouses' },
];

const LIST_TITLE: Record<OnecList, string> = {
  counterparties: 'Контрагенты',
  products: 'Номенклатура',
  warehouses: 'Склады',
  receipts: 'Поступление товаров',
  sales: 'Реализация товаров',
  balances: 'Остатки товаров',
};

type IconName = 'home' | 'book' | 'doc' | 'chart' | 'tree';

const fieldClass =
  'h-11 w-full rounded-sm border border-[#8f8f8f] bg-white px-2 text-[16px] text-[#1f1f1f] outline-none md:h-7 md:text-[13px]';

const cmdClass =
  'inline-flex min-h-11 items-center rounded-sm border border-[#bdbdbd] bg-[#f7f7f7] px-2.5 text-[16px] text-[#1f1f1f] md:min-h-8 md:text-[13px]';

const cmdPrimary =
  'inline-flex min-h-11 items-center rounded-sm border border-[#d6b000] bg-[#ffe14a] px-2.5 text-[16px] font-medium text-[#1f1f1f] md:min-h-8 md:text-[13px]';

const formatDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
};

const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

const isCatalogList = (list: OnecList | null): boolean =>
  list === 'counterparties' || list === 'products' || list === 'warehouses';

const resolveSpot = (
  focus: OnecFocus | undefined,
  section: OnecSection,
  list: OnecList | null,
  draftKind: 'receipt' | 'sale' | null,
  creating: boolean,
): Spot | null => {
  if (!focus) return null;
  const inCatalogs = section === 'catalogs';
  const inDocs = section === 'documents';
  const inReports = section === 'reports';
  const inConfig = section === 'config';
  switch (focus) {
    case 'sections':
      return 'sections';
    case 'catalog-nav':
      return inCatalogs ? 'function-panel' : 'section-catalogs';
    case 'document-nav':
      return inDocs ? 'function-panel' : 'section-documents';
    case 'report-nav':
      return inReports ? 'function-panel' : 'section-reports';
    case 'metadata':
      return inConfig ? 'metadata' : 'section-config';
    case 'query':
      if (list === 'balances' || inConfig) return 'query';
      if (inReports) return 'fn-balances';
      return 'section-reports';
    case 'counterparty-create':
      if (creating && isCatalogList(list)) return 'catalog-form';
      if (isCatalogList(list)) return 'create';
      if (inCatalogs) return 'function-panel';
      return 'section-catalogs';
    case 'receipt-create':
      if (draftKind === 'receipt') return 'doc-form';
      if (list === 'receipts') return 'create';
      if (inDocs) return 'fn-receipts';
      return 'section-documents';
    case 'sale-create':
      if (draftKind === 'sale') return 'doc-form';
      if (list === 'sales') return 'create';
      if (inDocs) return 'fn-sales';
      return 'section-documents';
    case 'receipt-fields':
      if (draftKind) return 'fields';
      if (list === 'receipts' || list === 'sales') return 'create';
      if (inDocs) return 'function-panel';
      return 'section-documents';
    case 'post':
      if (draftKind) return 'post';
      if (inDocs) return 'function-panel';
      return 'section-documents';
    case 'mark':
      if (draftKind) return 'mark';
      if (list === 'counterparties' || list === 'products' || list === 'warehouses') return 'mark';
      if (inCatalogs) return 'function-panel';
      return 'section-catalogs';
    default:
      return null;
  }
};

const Glyph = ({ name }: { name: IconName }) => {
  const common = {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: '#3f3f3f',
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true as const,
  };
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4 11 L12 4 L20 11 V20 H4 Z" />
        <path d="M10 20 V14 H14 V20" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg {...common}>
        <path d="M5 5 H11 A2 2 0 0 1 13 7 V19 H7 A2 2 0 0 1 5 17 Z" />
        <path d="M19 5 H13 A2 2 0 0 0 11 7 V19 H17 A2 2 0 0 0 19 17 Z" />
      </svg>
    );
  }
  if (name === 'doc') {
    return (
      <svg {...common}>
        <path d="M7 3 H14 L19 8 V21 H7 Z" />
        <path d="M14 3 V8 H19" />
        <path d="M10 13 H16" />
        <path d="M10 17 H16" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19 H20" />
        <path d="M7 19 V11" />
        <path d="M12 19 V6" />
        <path d="M17 19 V14" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3 V21" />
      <path d="M12 7 H18 V11 H12" />
      <path d="M12 13 H6 V17 H12" />
    </svg>
  );
};

export const OnecStand = ({ seed, commands, onChange, focus, locked = false }: OnecStandProps) => {
  const state = useMemo(() => replayOnec(seed, commands), [seed, commands]);
  const [banner, setBanner] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [lineProduct, setLineProduct] = useState('');
  const [lineQty, setLineQty] = useState('10');
  const [linePrice, setLinePrice] = useState('100');
  const [showMoves, setShowMoves] = useState(false);
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('ВЫБРАТЬ Номенклатура, Склад, Количество\nИЗ Остатки');

  useEffect(() => {
    setBanner(null);
    setCreating(false);
    setShowMoves(false);
    setCatalogName('');
  }, [seed, commands.length]);

  useEffect(() => {
    setSearch('');
  }, [state.ui.list]);

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

  const receipt = draftReceipt(state);
  const draft = state.ui.draft;
  const balances = onecBalances(state);
  const spot = resolveSpot(focus, state.ui.section, state.ui.list, draft?.kind ?? null, creating);
  const lit = (id: Spot): string =>
    spot === id ? 'outline outline-2 outline-offset-2 outline-[#c65c12]' : '';
  const attr = (id: Spot): { 'data-onec-focus'?: string } =>
    spot === id && focus ? { 'data-onec-focus': focus } : {};

  const openList = (object: OnecList): void => {
    setCreating(false);
    send({ op: 'open-list', object });
  };

  const tabTitle = draft
    ? `${draft.kind === 'sale' ? 'Реализация' : 'Поступление'} ${draft.number}`
    : creating
      ? `${state.ui.list ? LIST_TITLE[state.ui.list] : 'Элемент'} (создание)`
      : state.ui.list
        ? LIST_TITLE[state.ui.list]
        : null;

  return (
    <div className="flex h-[min(44rem,calc(100dvh-9rem))] min-h-[32rem] flex-col overflow-hidden border border-[#b5b5b5] bg-white font-[Arial,Helvetica,sans-serif] text-[16px] text-[#1f1f1f] shadow-sm md:text-[13px]">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          className={cx(
            'flex shrink-0 gap-0.5 overflow-x-auto bg-[#f8d20a] p-1 md:w-48 md:flex-col md:overflow-y-auto',
            lit('sections'),
          )}
          aria-label="Панель разделов"
          {...attr('sections')}
        >
          <div className="hidden items-center gap-2 px-2 py-2 md:flex">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-white/80 text-[11px] font-semibold">
              УТ
            </span>
            <span className="text-[13px] font-semibold leading-tight">
              Учёт
              <br />
              товаров
            </span>
          </div>
          {SECTIONS.map((section) => {
            const active = state.ui.section === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => send({ op: 'open-section', section: section.id })}
                className={cx(
                  'flex min-h-11 min-w-[4.5rem] shrink-0 items-center gap-2 rounded-sm px-2 py-1 text-left md:min-w-0',
                  active ? 'bg-[#fff8cc] font-semibold' : 'hover:bg-[#ffe56a]',
                  lit(section.spot),
                )}
                {...attr(section.spot)}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/75">
                  <Glyph name={section.icon} />
                </span>
                <span className="text-[12px] leading-tight md:text-[13px]">{section.label}</span>
              </button>
            );
          })}
          <div className="mt-auto hidden px-2 py-2 text-[11px] text-[#5a4a10] md:block">Ученик</div>
        </nav>

        <aside
          className={cx(
            'flex shrink-0 gap-1 overflow-x-auto border-b border-[#e4d48a] bg-[#fff3b0] p-1 md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r',
            lit('function-panel'),
          )}
          aria-label="Панель функций"
          {...attr('function-panel')}
        >
          <p className="hidden px-2 py-2 text-[12px] font-semibold text-[#6a5420] md:block">
            {SECTIONS.find((item) => item.id === state.ui.section)?.label}
          </p>
          {state.ui.section === 'home' ? (
            <FunctionItem
              active
              label="Начальная страница"
              onClick={() => send({ op: 'open-section', section: 'home' })}
            />
          ) : null}
          {state.ui.section === 'catalogs'
            ? CATALOGS.map((catalog) => (
                <FunctionItem
                  key={catalog.id}
                  label={catalog.label}
                  active={state.ui.list === catalog.id && !draft}
                  className={lit(catalog.spot)}
                  attrs={attr(catalog.spot)}
                  onClick={() => openList(catalog.id)}
                />
              ))
            : null}
          {state.ui.section === 'documents' ? (
            <>
              <FunctionItem
                label="Поступление товаров"
                active={state.ui.list === 'receipts' && !draft}
                className={lit('fn-receipts')}
                attrs={attr('fn-receipts')}
                onClick={() => openList('receipts')}
              />
              <FunctionItem
                label="Реализация товаров"
                active={state.ui.list === 'sales' && !draft}
                className={lit('fn-sales')}
                attrs={attr('fn-sales')}
                onClick={() => openList('sales')}
              />
            </>
          ) : null}
          {state.ui.section === 'reports' ? (
            <FunctionItem
              label="Остатки товаров"
              active={state.ui.list === 'balances' && !draft}
              className={lit('fn-balances')}
              attrs={attr('fn-balances')}
              onClick={() => openList('balances')}
            />
          ) : null}
          {state.ui.section === 'config' ? (
            <FunctionItem
              active
              label="Дерево объектов"
              onClick={() => send({ op: 'open-section', section: 'config' })}
            />
          ) : null}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <div
            className="flex h-11 shrink-0 items-end gap-1 overflow-x-auto border-b border-[#d0d0d0] bg-[#ececec] px-1 md:h-9"
            aria-label="Панель открытых"
          >
            <button
              type="button"
              onClick={() => send({ op: 'open-section', section: 'home' })}
              className={cx(
                'inline-flex min-h-11 items-center gap-1.5 px-3 text-[16px] md:min-h-8 md:text-[13px]',
                state.ui.section === 'home' && !draft
                  ? 'border border-b-white border-[#d0d0d0] bg-white'
                  : 'text-[#444]',
              )}
            >
              <Glyph name="home" />
              Начальная страница
            </button>
            {tabTitle ? (
              <span className="inline-flex min-h-11 items-center border border-b-white border-[#d0d0d0] bg-white md:min-h-8">
                <span className="px-3">{tabTitle}</span>
                <button
                  type="button"
                  aria-label="Закрыть"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-[#666] md:min-h-8 md:min-w-8"
                  onClick={() => {
                    if (creating) {
                      setCreating(false);
                      setCatalogName('');
                      return;
                    }
                    if (draft) {
                      setShowMoves(false);
                      send({ op: 'close-form' });
                      return;
                    }
                    send({ op: 'open-section', section: state.ui.section });
                  }}
                >
                  ×
                </button>
              </span>
            ) : null}
          </div>

          {banner ? (
            <p
              className="shrink-0 border-b border-[#e7b4a0] bg-[#fff4f0] px-3 py-2 text-[16px] text-[#8a341c] md:text-[13px]"
              role="alert"
            >
              {banner}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto bg-white">
            {state.ui.section === 'home' && !draft ? <HomePane onOpen={openList} /> : null}

            {state.ui.list &&
            (state.ui.list === 'counterparties' ||
              state.ui.list === 'products' ||
              state.ui.list === 'warehouses') &&
            !draft &&
            !creating ? (
              <CatalogList
                title={LIST_TITLE[state.ui.list]}
                rows={state[state.ui.list].filter((row) =>
                  row.name.toLowerCase().includes(search.trim().toLowerCase()),
                )}
                total={state[state.ui.list].length}
                search={search}
                onSearch={setSearch}
                litCreate={lit('create')}
                createAttr={attr('create')}
                litMark={lit('mark')}
                markAttr={attr('mark')}
                onCreate={() => setCreating(true)}
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
              />
            ) : null}

            {creating && !draft ? (
              <CatalogForm
                title={`${state.ui.list ? LIST_TITLE[state.ui.list] : 'Элемент'} (создание)`}
                name={catalogName}
                lit={lit('catalog-form')}
                attrs={attr('catalog-form')}
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
              <DocList
                title="Поступление товаров"
                rows={state.receipts}
                litCreate={lit('create')}
                createAttr={attr('create')}
                onCreate={() => send({ op: 'open-new-receipt' })}
                onOpen={(id) => send({ op: 'open-receipt', id })}
              />
            ) : null}

            {state.ui.list === 'sales' && !draft ? (
              <DocList
                title="Реализация товаров"
                rows={state.sales}
                litCreate={lit('create')}
                createAttr={attr('create')}
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
                formLit={lit('doc-form')}
                formAttr={attr('doc-form')}
                fieldsLit={lit('fields')}
                fieldsAttr={attr('fields')}
                postLit={lit('post')}
                postAttr={attr('post')}
                markLit={lit('mark')}
                markAttr={attr('mark')}
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
                onClose={() => {
                  setShowMoves(false);
                  send({ op: 'close-form' });
                }}
                onToggleMoves={() => setShowMoves((value) => !value)}
              />
            ) : null}

            {state.ui.list === 'balances' && !draft ? (
              <div className="space-y-0">
                <BalancePane rows={balances} />
                <QueryPane
                  text={queryText}
                  rows={state.lastQuery?.rows}
                  lit={lit('query')}
                  attrs={attr('query')}
                  onText={setQueryText}
                  onRun={() => send({ op: 'run-query', text: queryText })}
                />
              </div>
            ) : null}

            {state.ui.section === 'config' && !draft ? (
              <div>
                <ConfigPane lit={lit('metadata')} attrs={attr('metadata')} />
                <QueryPane
                  text={queryText}
                  rows={state.lastQuery?.rows}
                  lit={lit('query')}
                  attrs={attr('query')}
                  onText={setQueryText}
                  onRun={() => send({ op: 'run-query', text: queryText })}
                />
              </div>
            ) : null}

            {state.ui.section !== 'home' &&
            state.ui.section !== 'config' &&
            !state.ui.list &&
            !draft ? (
              <p className="px-4 py-6 text-[#666]">Выберите команду на панели функций.</p>
            ) : null}
          </div>
        </div>
      </div>
      <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-[#d0d0d0] bg-[#f4f4f4] px-3 text-[11px] text-[#555]">
        <span>Ученик</span>
        <span>{formatDate(state.today)}</span>
      </footer>
    </div>
  );
};

const FunctionItem = ({
  label,
  active,
  onClick,
  className,
  attrs,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  attrs?: { 'data-onec-focus'?: string };
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      'min-h-11 shrink-0 rounded-sm px-3 text-left text-[16px] md:min-h-8 md:text-[13px]',
      active ? 'bg-white font-semibold' : 'hover:bg-[#fff8d6]',
      className,
    )}
    {...attrs}
  >
    {label}
  </button>
);

const HomePane = ({ onOpen }: { onOpen: (object: OnecList) => void }) => (
  <div className="bg-[#f7f7f7] p-3 md:p-5">
    <h2 className="mb-3 text-[16px] font-semibold md:text-[15px]">Начальная страница</h2>
    <div className="grid gap-3 md:grid-cols-3">
      <HomeGroup title="Справочники">
        <HomeLink label="Контрагенты" onClick={() => onOpen('counterparties')} />
        <HomeLink label="Номенклатура" onClick={() => onOpen('products')} />
        <HomeLink label="Склады" onClick={() => onOpen('warehouses')} />
      </HomeGroup>
      <HomeGroup title="Документы">
        <HomeLink label="Поступление товаров" onClick={() => onOpen('receipts')} />
        <HomeLink label="Реализация товаров" onClick={() => onOpen('sales')} />
      </HomeGroup>
      <HomeGroup title="Отчёты">
        <HomeLink label="Остатки товаров" onClick={() => onOpen('balances')} />
      </HomeGroup>
    </div>
  </div>
);

const HomeGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border border-[#e0e0e0] bg-white">
    <h3 className="border-b border-[#eee] px-3 py-2 text-[13px] font-semibold text-[#c65c12]">
      {title}
    </h3>
    <div className="flex flex-col">{children}</div>
  </section>
);

const HomeLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-11 border-b border-[#f2f2f2] px-3 text-left text-[16px] last:border-0 hover:bg-[#fff8dc] md:min-h-9 md:text-[13px]"
  >
    {label}
  </button>
);

const CatalogList = ({
  title,
  rows,
  total,
  search,
  onSearch,
  litCreate,
  createAttr,
  litMark,
  markAttr,
  onCreate,
  onToggleMark,
}: {
  title: string;
  rows: { id: string; code: string; name: string; deletionMark: boolean }[];
  total: number;
  search: string;
  onSearch: (value: string) => void;
  litCreate: string;
  createAttr: { 'data-onec-focus'?: string };
  litMark: string;
  markAttr: { 'data-onec-focus'?: string };
  onCreate: () => void;
  onToggleMark: (name: string) => void;
}) => (
  <div className="flex min-h-full flex-col">
    <FormTitle title={title} />
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e4e4] bg-[#f7f7f7] px-2 py-1">
      <button
        type="button"
        onClick={onCreate}
        className={cx(cmdPrimary, litCreate)}
        {...createAttr}
      >
        Создать
      </button>
      <label
        htmlFor="onec-find"
        className="flex min-w-[10rem] flex-1 items-center gap-2 text-[#666]"
      >
        <span className="sr-only">Найти</span>
        <input
          id="onec-find"
          aria-label="Найти"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Найти"
          className={cx(fieldClass, 'md:max-w-xs')}
        />
      </label>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <thead className="bg-[#f4f4f4] text-[#555]">
          <tr>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Наименование</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Код</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Пометка</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-3 text-[#777]" colSpan={3}>
                Список пуст
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-[#fff6cc]">
                <td
                  className={cx(
                    'border border-[#eee] px-2 py-1.5',
                    row.deletionMark && 'text-[#a32020] line-through',
                  )}
                >
                  {row.name}
                </td>
                <td className="border border-[#eee] px-2 py-1.5 tabular-nums">{row.code}</td>
                <td className="border border-[#eee] px-2 py-1.5">
                  <button
                    type="button"
                    className={cx('min-h-11 text-[#444] md:min-h-8', index === 0 && litMark)}
                    {...(index === 0 ? markAttr : {})}
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
    <p className="mt-auto border-t border-[#eee] px-3 py-1.5 text-[12px] text-[#666]">
      Всего: {total}
    </p>
  </div>
);

const CatalogForm = ({
  title,
  name,
  lit,
  attrs,
  onName,
  onCancel,
  onSave,
}: {
  title: string;
  name: string;
  lit: string;
  attrs: { 'data-onec-focus'?: string };
  onName: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) => (
  <form
    className={cx('flex min-h-full flex-col', lit)}
    {...attrs}
    onSubmit={(event) => {
      event.preventDefault();
      onSave();
    }}
  >
    <FormTitle title={title} />
    <div className="flex flex-wrap gap-2 border-b border-[#e4e4e4] bg-[#f7f7f7] px-2 py-1">
      <button type="submit" className={cmdPrimary}>
        Записать и закрыть
      </button>
      <button type="button" onClick={onCancel} className={cmdClass}>
        Отмена
      </button>
    </div>
    <div className="grid max-w-xl gap-2 p-3">
      <p className="text-[13px] font-semibold text-[#c65c12]">Основное</p>
      <label
        htmlFor="onec-catalog-name"
        className="grid items-center gap-1 md:grid-cols-[9rem_1fr]"
      >
        <span className="text-[#555]">Наименование</span>
        <input
          id="onec-catalog-name"
          aria-label="Наименование"
          value={name}
          onChange={(event) => onName(event.target.value)}
          className={fieldClass}
          autoComplete="off"
        />
      </label>
    </div>
  </form>
);

const DocList = ({
  title,
  rows,
  litCreate,
  createAttr,
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
  litCreate: string;
  createAttr: { 'data-onec-focus'?: string };
  onCreate: () => void;
  onOpen: (id: string) => void;
}) => (
  <div className="flex min-h-full flex-col">
    <FormTitle title={title} />
    <div className="border-b border-[#e4e4e4] bg-[#f7f7f7] px-2 py-1">
      <button
        type="button"
        onClick={onCreate}
        className={cx(cmdPrimary, litCreate)}
        {...createAttr}
      >
        Создать
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <thead className="bg-[#f4f4f4] text-[#555]">
          <tr>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Номер</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Дата</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Контрагент</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Состояние</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-3 text-[#777]" colSpan={4}>
                Документов нет
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#fff6cc]">
                <td className="border border-[#eee] px-2 py-1.5">
                  <button
                    type="button"
                    className={cx(
                      'min-h-11 text-left text-[#1a4f8b] underline-offset-2 hover:underline md:min-h-8',
                      row.deletionMark && 'line-through',
                    )}
                    onClick={() => onOpen(row.id)}
                  >
                    {row.number}
                  </button>
                </td>
                <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                  {formatDate(row.date)}
                </td>
                <td className="border border-[#eee] px-2 py-1.5">{row.counterpartyName}</td>
                <td className="border border-[#eee] px-2 py-1.5">
                  {row.posted ? 'Проведен' : 'Записан'}
                  {row.deletionMark ? ', помечен' : ''}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <p className="mt-auto border-t border-[#eee] px-3 py-1.5 text-[12px] text-[#666]">
      Всего: {rows.length}
    </p>
  </div>
);

const FormTitle = ({ title, extra }: { title: string; extra?: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-[#e4e4e4] px-3 py-2">
    <h2 className="text-[16px] font-semibold md:text-[15px]">{title}</h2>
    {extra ? <span className="text-[12px] text-[#555]">{extra}</span> : null}
  </div>
);

const ReceiptForm = ({
  title,
  draft,
  posted,
  marked,
  counterparties,
  warehouses,
  products,
  lineProduct,
  lineQty,
  linePrice,
  showMoves,
  warehouseName,
  formLit,
  formAttr,
  fieldsLit,
  fieldsAttr,
  postLit,
  postAttr,
  markLit,
  markAttr,
  onField,
  onLineProduct,
  onLineQty,
  onLinePrice,
  onAddLine,
  onRemoveLine,
  onPost,
  onSave,
  onUnpost,
  onMark,
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
  counterparties: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string }[];
  lineProduct: string;
  lineQty: string;
  linePrice: string;
  showMoves: boolean;
  warehouseName: string;
  formLit: string;
  formAttr: { 'data-onec-focus'?: string };
  fieldsLit: string;
  fieldsAttr: { 'data-onec-focus'?: string };
  postLit: string;
  postAttr: { 'data-onec-focus'?: string };
  markLit: string;
  markAttr: { 'data-onec-focus'?: string };
  onField: (field: 'counterparty' | 'warehouse', value: string) => void;
  onLineProduct: (value: string) => void;
  onLineQty: (value: string) => void;
  onLinePrice: (value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onPost: () => void;
  onSave: () => void;
  onUnpost: () => void;
  onMark: () => void;
  onClose: () => void;
  onToggleMoves: () => void;
}) => {
  const qtyTotal = draft.lines.reduce((sum, line) => sum + line.qty, 0);
  const sumTotal = draft.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  return (
    <div className={cx('flex min-h-full flex-col', formLit)} {...formAttr}>
      <FormTitle
        title={`${title} ${draft.number} от ${formatDate(draft.date)}${marked ? ' (пометка удаления)' : ''}`}
        extra={posted ? 'Проведен' : 'Не проведен'}
      />
      <div className="flex flex-wrap gap-1 border-b border-[#e4e4e4] bg-[#f7f7f7] px-2 py-1">
        <button type="button" onClick={onPost} className={cx(cmdPrimary, postLit)} {...postAttr}>
          Провести
        </button>
        <button type="button" onClick={onSave} className={cmdClass}>
          Записать
        </button>
        <button type="button" onClick={onUnpost} className={cmdClass}>
          Отмена проведения
        </button>
        <button type="button" onClick={onToggleMoves} className={cmdClass}>
          Движения
        </button>
        <button type="button" onClick={onMark} className={cx(cmdClass, markLit)} {...markAttr}>
          {marked ? 'Снять пометку' : 'Пометить на удаление'}
        </button>
        <button type="button" onClick={onClose} className={cmdClass}>
          Закрыть
        </button>
      </div>
      <div className={cx('grid gap-2 p-3 md:grid-cols-2', fieldsLit)} {...fieldsAttr}>
        <p className="text-[13px] font-semibold text-[#c65c12] md:col-span-2">Шапка</p>
        <Field label="Контрагент">
          <select
            aria-label="Контрагент"
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
        </Field>
        <Field label="Склад">
          <select
            aria-label="Склад"
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
        </Field>
      </div>
      <div className="border-t border-[#e4e4e4]">
        <p className="border-b border-[#eee] px-3 py-1.5 text-[13px] font-semibold text-[#c65c12]">
          Товары ({draft.lines.length})
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead className="bg-[#f4f4f4] text-[#555]">
              <tr>
                <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Номенклатура</th>
                <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Количество</th>
                <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Цена</th>
                <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Сумма</th>
                <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">
                  <span className="sr-only">Удалить</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => (
                <tr key={`${line.productName}-${index}`}>
                  <td className="border border-[#eee] px-2 py-1.5">{line.productName}</td>
                  <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                    {formatQty(line.qty)}
                  </td>
                  <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                    {formatQty(line.price)}
                  </td>
                  <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                    {formatQty(line.qty * line.price)}
                  </td>
                  <td className="border border-[#eee] px-2 py-1.5">
                    <button
                      type="button"
                      className="min-h-11 text-[#8a341c] md:min-h-8"
                      onClick={() => onRemoveLine(index)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="grid gap-2 border-t border-[#eee] p-3 md:grid-cols-[1.4fr_0.6fr_0.6fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onAddLine();
          }}
        >
          <Field label="Номенклатура">
            <select
              aria-label="Номенклатура"
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
          </Field>
          <Field label="Количество">
            <input
              aria-label="Количество"
              className={fieldClass}
              inputMode="decimal"
              value={lineQty}
              onChange={(event) => onLineQty(event.target.value)}
            />
          </Field>
          <Field label="Цена">
            <input
              aria-label="Цена"
              className={fieldClass}
              inputMode="decimal"
              value={linePrice}
              onChange={(event) => onLinePrice(event.target.value)}
            />
          </Field>
          <button type="submit" className={cmdClass}>
            Добавить
          </button>
        </form>
        <p className="border-t border-[#eee] px-3 py-1.5 text-[12px] text-[#555]">
          Количество: {formatQty(qtyTotal)} · Сумма: {formatQty(sumTotal)}
        </p>
      </div>
      {showMoves ? (
        <div className="border-t border-[#e4e4e4]">
          <p className="border-b border-[#eee] px-3 py-1.5 text-[13px] font-semibold">
            Движения: товары на складах
          </p>
          {posted ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[24rem] text-left">
                <thead className="bg-[#f4f4f4] text-[#555]">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Вид</th>
                    <th className="px-2 py-1.5 font-medium">Номенклатура</th>
                    <th className="px-2 py-1.5 font-medium">Склад</th>
                    <th className="px-2 py-1.5 font-medium">Количество</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((line, index) => (
                    <tr key={`move-${index}`} className="border-t border-[#eee]">
                      <td className="px-2 py-1.5">
                        {title.startsWith('Реализация') ? 'Расход' : 'Приход'}
                      </td>
                      <td className="px-2 py-1.5">{line.productName}</td>
                      <td className="px-2 py-1.5">{warehouseName}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatQty(line.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-3 text-[#666]">Движений нет: документ не проведён.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid items-center gap-1 md:grid-cols-[7.5rem_1fr]">
    <span className="text-[#555]">{label}</span>
    {children}
  </div>
);

const BalancePane = ({
  rows,
}: {
  rows: { productName: string; warehouseName: string; qty: number; sum: number }[];
}) => (
  <div>
    <FormTitle title="Остатки товаров" />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[24rem] border-collapse text-left">
        <thead className="bg-[#f4f4f4] text-[#555]">
          <tr>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Номенклатура</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Склад</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Количество</th>
            <th className="border border-[#e4e4e4] px-2 py-1.5 font-medium">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-3 text-[#777]" colSpan={4}>
                Остатков нет. Проведите документ поступления.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.productName}-${row.warehouseName}`} className="hover:bg-[#fff6cc]">
                <td className="border border-[#eee] px-2 py-1.5">{row.productName}</td>
                <td className="border border-[#eee] px-2 py-1.5">{row.warehouseName}</td>
                <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                  {formatQty(row.qty)}
                </td>
                <td className="border border-[#eee] px-2 py-1.5 tabular-nums">
                  {formatQty(row.sum)}
                </td>
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
  lit,
  attrs,
  onText,
  onRun,
}: {
  text: string;
  rows: Record<string, string | number | boolean>[] | undefined;
  lit: string;
  attrs: { 'data-onec-focus'?: string };
  onText: (value: string) => void;
  onRun: () => void;
}) => {
  const columns = rows && rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  return (
    <form
      className={cx('border-t border-[#e4e4e4] p-3', lit)}
      {...attrs}
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <p className="text-[13px] font-semibold text-[#c65c12]">Консоль запроса</p>
      <p className="mt-1 text-[#666]">
        ВЫБРАТЬ поля ИЗ Остатки, Поступления или Реализации. Одно условие: ГДЕ Поле =
        &quot;текст&quot;, число или Да/Нет.
      </p>
      <textarea
        aria-label="Текст запроса"
        value={text}
        onChange={(event) => onText(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-sm border border-[#8f8f8f] p-2 text-[16px] text-[#1f1f1f] md:text-[13px]"
      />
      <button type="submit" className={cx(cmdPrimary, 'mt-2')}>
        Выполнить
      </button>
      {rows ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left">
            <thead className="bg-[#f4f4f4] text-[#555]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-2 py-1 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-[#777]">Пустой результат</td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={index} className="border-t border-[#eee]">
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

const ConfigPane = ({ lit, attrs }: { lit: string; attrs: { 'data-onec-focus'?: string } }) => (
  <div className={cx('p-3', lit)} {...attrs}>
    <FormTitle title="Конфигурация «Учёт товаров»" extra="только чтение" />
    <ul className="mt-2 space-y-1 pl-1 text-[#333]">
      <li className="font-semibold text-[#c65c12]">Справочники</li>
      <li className="pl-4">Контрагенты</li>
      <li className="pl-4">Номенклатура</li>
      <li className="pl-4">Склады</li>
      <li className="pt-2 font-semibold text-[#c65c12]">Документы</li>
      <li className="pl-4">Поступление товаров пишет приход в регистр «Товары на складах».</li>
      <li className="pl-4">
        Реализация товаров пишет расход и не проводится, если остаток уйдёт ниже нуля.
      </li>
      <li className="pt-2 font-semibold text-[#c65c12]">Регистры накопления</li>
      <li className="pl-4">
        Товары на складах. Пометка удаления не снимает проведение и не стирает движения.
      </li>
      <li className="pl-4">Отчёт и таблица Остатки читают только проведённые документы.</li>
    </ul>
  </div>
);
