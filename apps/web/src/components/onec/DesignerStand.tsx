import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type {
  DesignerCommand,
  DesignerField,
  DesignerFocus,
  DesignerGuard,
  DesignerScreen,
  DesignerSeed,
} from '@dotlearn/contracts';
import {
  applyDesignerCommand,
  designerBalances,
  DesignerCommandError,
  replayDesigner,
  type DesignerState,
} from '@dotlearn/lesson-engine';

import { cx } from '@/components/ui/cx';

interface DesignerStandProps {
  seed: DesignerSeed;
  commands: readonly DesignerCommand[];
  onChange: (commands: DesignerCommand[]) => void;
  focus?: DesignerFocus | undefined;
  locked?: boolean;
}

type Spot =
  | 'mode-designer'
  | 'mode-enterprise'
  | 'mode-report'
  | 'add-catalog'
  | 'add-document'
  | 'add-register'
  | 'meta-tree'
  | 'add-field'
  | 'add-movement'
  | 'add-guard'
  | 'object-list'
  | 'doc-form'
  | 'post';

const MODES: { id: DesignerScreen; label: string; spot: Spot }[] = [
  { id: 'designer', label: 'Конструктор', spot: 'mode-designer' },
  { id: 'enterprise', label: 'Предприятие', spot: 'mode-enterprise' },
  { id: 'report', label: 'Остатки', spot: 'mode-report' },
];

const fieldClass =
  'h-11 w-full rounded-sm border border-[#8f8f8f] bg-white px-2 text-[16px] text-[#1f1f1f] outline-none md:h-7 md:text-[13px]';
const cmdClass =
  'inline-flex min-h-11 items-center rounded-sm border border-[#bdbdbd] bg-[#f7f7f7] px-2.5 text-[16px] text-[#1f1f1f] md:min-h-8 md:text-[13px]';
const cmdPrimary =
  'inline-flex min-h-11 items-center rounded-sm border border-[#d6b000] bg-[#ffe14a] px-2.5 text-[16px] font-medium text-[#1f1f1f] md:min-h-8 md:text-[13px]';

const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

const resolveSpot = (
  focus: DesignerFocus | undefined,
  mode: DesignerScreen,
  draft: boolean,
): Spot | null => {
  if (!focus) return null;
  if (focus === 'mode-designer') return mode === 'designer' ? 'meta-tree' : 'mode-designer';
  if (focus === 'mode-enterprise') return mode === 'enterprise' ? 'object-list' : 'mode-enterprise';
  if (focus === 'mode-report') return mode === 'report' ? 'object-list' : 'mode-report';
  if (
    focus === 'add-catalog' ||
    focus === 'add-document' ||
    focus === 'add-register' ||
    focus === 'add-field' ||
    focus === 'add-movement' ||
    focus === 'add-guard' ||
    focus === 'meta-tree'
  ) {
    return mode === 'designer' ? focus : 'mode-designer';
  }
  if (draft && (focus === 'doc-form' || focus === 'post' || focus === 'object-list')) {
    return focus === 'post' ? 'post' : 'doc-form';
  }
  if (mode === 'enterprise' || mode === 'report') return 'object-list';
  return 'mode-enterprise';
};

export const DesignerStand = ({
  seed,
  commands,
  onChange,
  focus,
  locked = false,
}: DesignerStandProps) => {
  const state = useMemo(() => replayDesigner(seed, commands), [seed, commands]);
  const [banner, setBanner] = useState<string | null>(null);
  const [objectName, setObjectName] = useState('');
  const spot = resolveSpot(focus, state.ui.mode, state.ui.draft !== null);
  const lit = (id: Spot): string =>
    spot === id ? 'outline outline-2 outline-offset-2 outline-[#c65c12]' : '';
  const attr = (id: Spot): { 'data-onec-focus'?: string } =>
    spot === id && focus ? { 'data-onec-focus': focus } : {};

  useEffect(() => {
    setBanner(null);
  }, [commands.length, seed]);

  const sendBatch = (batch: DesignerCommand[]): void => {
    if (locked || batch.length === 0) return;
    let current = state;
    const accepted: DesignerCommand[] = [];
    for (const command of batch) {
      try {
        current = applyDesignerCommand(current, command);
        accepted.push(command);
      } catch (error) {
        if (accepted.length > 0) onChange([...commands, ...accepted]);
        setBanner(error instanceof DesignerCommandError ? error.message : 'Команда не выполнилась');
        return;
      }
    }
    onChange([...commands, ...accepted]);
    setBanner(null);
  };

  const addObject = (op: 'add-catalog' | 'add-document' | 'add-register'): void => {
    const name = objectName.trim();
    if (name === '') {
      setBanner('Введите имя объекта');
      return;
    }
    sendBatch([{ op, name }]);
    setObjectName('');
  };

  return (
    <div className="flex h-[min(46rem,calc(100dvh-9rem))] min-h-[34rem] flex-col overflow-hidden border border-[#b5b5b5] bg-white font-[Arial,Helvetica,sans-serif] text-[16px] text-[#1f1f1f] shadow-sm md:text-[13px]">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          className="flex shrink-0 gap-0.5 overflow-x-auto bg-[#f8d20a] p-1 md:w-48 md:flex-col md:overflow-y-auto"
          aria-label="Панель разделов"
        >
          <div className="hidden items-center gap-2 px-2 py-2 md:flex">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-white/80 text-[11px] font-semibold">
              УЗ
            </span>
            <span className="text-[13px] font-semibold leading-tight">
              Учёт
              <br />
              завода
            </span>
          </div>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => sendBatch([{ op: 'open-mode', mode: mode.id }])}
              className={cx(
                'flex min-h-11 min-w-[6.5rem] shrink-0 items-center rounded-sm px-2 py-1 text-left md:min-w-0',
                state.ui.mode === mode.id ? 'bg-[#fff8cc] font-semibold' : 'hover:bg-[#ffe56a]',
                lit(mode.spot),
              )}
              {...attr(mode.spot)}
            >
              {mode.label}
            </button>
          ))}
        </nav>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {banner ? (
            <p
              className="border-b border-[#f0c2b0] bg-[#fff1ec] px-3 py-2 text-[#8a2b12]"
              role="alert"
            >
              {banner}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
            {state.ui.mode === 'designer' ? (
              <DesignerPane
                state={state}
                objectName={objectName}
                onObjectName={setObjectName}
                onAdd={addObject}
                onCommand={(command) => sendBatch([command])}
                lit={lit}
                attr={attr}
              />
            ) : null}
            {state.ui.mode === 'enterprise' ? (
              <EnterprisePane state={state} onBatch={sendBatch} lit={lit} attr={attr} />
            ) : null}
            {state.ui.mode === 'report' ? <ReportPane state={state} lit={lit} attr={attr} /> : null}
          </div>
        </section>
      </div>
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#d0d0d0] bg-[#f4f4f4] px-3 text-[11px] text-[#555]">
        <span>Ученик</span>
        <span>{seed.today.split('-').reverse().join('.')}</span>
      </footer>
    </div>
  );
};

const DesignerPane = ({
  state,
  objectName,
  onObjectName,
  onAdd,
  onCommand,
  lit,
  attr,
}: {
  state: DesignerState;
  objectName: string;
  onObjectName: (value: string) => void;
  onAdd: (op: 'add-catalog' | 'add-document' | 'add-register') => void;
  onCommand: (command: DesignerCommand) => void;
  lit: (id: Spot) => string;
  attr: (id: Spot) => { 'data-onec-focus'?: string };
}) => (
  <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className={cx('min-w-0', lit('meta-tree'))} {...attr('meta-tree')}>
      <h2 className="mb-2 text-[15px] font-semibold">Конфигурация</h2>
      <MetaTree state={state} />
    </div>
    <div className="space-y-3">
      <div className="space-y-2 border border-[#e4e4e4] bg-[#fafafa] p-2">
        <label className="block text-[#555]" htmlFor="plant-object-name">
          <span>Имя объекта</span>
          <input
            id="plant-object-name"
            aria-label="Имя объекта"
            value={objectName}
            onChange={(event) => onObjectName(event.target.value)}
            className={cx(fieldClass, 'mt-1')}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cx(cmdPrimary, lit('add-catalog'))}
            {...attr('add-catalog')}
            onClick={() => onAdd('add-catalog')}
          >
            Справочник
          </button>
          <button
            type="button"
            className={cx(cmdClass, lit('add-document'))}
            {...attr('add-document')}
            onClick={() => onAdd('add-document')}
          >
            Документ
          </button>
          <button
            type="button"
            className={cx(cmdClass, lit('add-register'))}
            {...attr('add-register')}
            onClick={() => onAdd('add-register')}
          >
            Регистр
          </button>
        </div>
      </div>
      <FieldForm
        state={state}
        lit={lit('add-field')}
        attr={attr('add-field')}
        onCommand={onCommand}
      />
      <DimensionForm state={state} onCommand={onCommand} />
      <MovementForm
        state={state}
        lit={lit('add-movement')}
        attr={attr('add-movement')}
        onCommand={onCommand}
      />
      <GuardForm
        state={state}
        lit={lit('add-guard')}
        attr={attr('add-guard')}
        onCommand={onCommand}
      />
    </div>
  </div>
);

const MetaTree = ({ state }: { state: DesignerState }) => (
  <ul className="space-y-2 text-[#333]">
    <TreeGroup title="Справочники">
      {state.catalogs.map((catalog) => (
        <li key={catalog.name}>
          <span className="font-medium">{catalog.name}</span>
          <ul className="pl-4">
            <li>Наименование</li>
            {catalog.fields.map((field) => (
              <li key={field.name}>
                {field.name}: {fieldLabel(field)}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </TreeGroup>
    <TreeGroup title="Документы">
      {state.documents.map((document) => (
        <li key={document.name}>
          <span className="font-medium">{document.name}</span>
          <ul className="pl-4">
            {document.fields.map((field) => (
              <li key={field.name}>
                {field.name}: {fieldLabel(field)}
              </li>
            ))}
            {document.movements.map((movement, index) => (
              <li key={`${movement.register}-${index}`}>
                {movement.direction === 'in' ? 'приход' : 'расход'} {movement.register},{' '}
                {movement.qtyField}
              </li>
            ))}
            {document.guards.map((guard, index) => (
              <li key={`${guard.kind}-${index}`}>условие: {guardLabel(guard)}</li>
            ))}
          </ul>
        </li>
      ))}
    </TreeGroup>
    <TreeGroup title="Регистры накопления">
      {state.registers.map((register) => (
        <li key={register.name}>
          <span className="font-medium">{register.name}</span>
          <ul className="pl-4">
            {register.dimensions.map((dimension) => (
              <li key={dimension.name}>
                {dimension.name} ({dimension.catalog})
              </li>
            ))}
          </ul>
        </li>
      ))}
    </TreeGroup>
  </ul>
);

const TreeGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <li>
    <p className="font-semibold text-[#c65c12]">{title}</p>
    <ul className="space-y-1 pl-3">{children}</ul>
  </li>
);

const fieldLabel = (field: DesignerField): string => {
  if (field.type === 'ref') return `ссылка ${field.ref ?? ''}`;
  if (field.type === 'enum') return `перечисление ${(field.enumValues ?? []).join(', ')}`;
  if (field.type === 'number') return 'число';
  if (field.type === 'datetime') return 'дата';
  return 'строка';
};

const guardLabel = (guard: DesignerGuard): string => {
  if (guard.kind === 'probe-count') return 'число проб';
  if (guard.kind === 'linked-status') return `статус = ${guard.value}`;
  if (guard.kind === 'linked-min-minutes') return `не раньше ${guard.minutes} мин`;
  if (guard.kind === 'linked-max-minutes') return `не позже ${guard.minutes} мин`;
  return `равно ${guard.value}`;
};

const FieldForm = ({
  state,
  lit,
  attr,
  onCommand,
}: {
  state: DesignerState;
  lit: string;
  attr: { 'data-onec-focus'?: string };
  onCommand: (command: DesignerCommand) => void;
}) => {
  const hosts = [...state.catalogs, ...state.documents];
  const [object, setObject] = useState(hosts[0]?.name ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState<DesignerField['type']>('string');
  const [ref, setRef] = useState(state.catalogs[0]?.name ?? '');
  const [enums, setEnums] = useState('');
  const selected = hosts.find((item) => item.name === object)?.name ?? hosts[0]?.name ?? '';

  return (
    <form
      className={cx('space-y-2 border border-[#e4e4e4] p-2', lit)}
      {...attr}
      onSubmit={(event) => {
        event.preventDefault();
        const enumValues = enums
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== '');
        onCommand({
          op: 'add-field',
          object: selected,
          name: name.trim(),
          type,
          ...(type === 'ref' ? { ref } : {}),
          ...(type === 'enum' ? { enumValues } : {}),
        });
        setName('');
      }}
    >
      <p className="font-semibold">Реквизит</p>
      <select
        aria-label="Объект реквизита"
        value={selected}
        onChange={(event) => setObject(event.target.value)}
        className={fieldClass}
      >
        {hosts.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <input
        aria-label="Имя реквизита"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Имя"
        className={fieldClass}
      />
      <select
        aria-label="Тип реквизита"
        value={type}
        onChange={(event) => setType(event.target.value as DesignerField['type'])}
        className={fieldClass}
      >
        <option value="string">Строка</option>
        <option value="number">Число</option>
        <option value="datetime">Дата и время</option>
        <option value="enum">Перечисление</option>
        <option value="ref">Ссылка</option>
      </select>
      {type === 'ref' ? (
        <select
          aria-label="Справочник ссылки"
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          className={fieldClass}
        >
          {state.catalogs.map((catalog) => (
            <option key={catalog.name}>{catalog.name}</option>
          ))}
        </select>
      ) : null}
      {type === 'enum' ? (
        <input
          aria-label="Значения перечисления"
          value={enums}
          onChange={(event) => setEnums(event.target.value)}
          placeholder="Значения через запятую"
          className={fieldClass}
        />
      ) : null}
      <button type="submit" className={cmdPrimary} disabled={selected === '' || name.trim() === ''}>
        Добавить реквизит
      </button>
    </form>
  );
};

const DimensionForm = ({
  state,
  onCommand,
}: {
  state: DesignerState;
  onCommand: (command: DesignerCommand) => void;
}) => {
  const [register, setRegister] = useState(state.registers[0]?.name ?? '');
  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState(state.catalogs[0]?.name ?? '');
  const selected =
    state.registers.find((item) => item.name === register)?.name ?? state.registers[0]?.name ?? '';

  return (
    <form
      className="space-y-2 border border-[#e4e4e4] p-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCommand({ op: 'add-dimension', register: selected, name: name.trim(), catalog });
        setName('');
      }}
    >
      <p className="font-semibold">Измерение регистра</p>
      <select
        aria-label="Регистр"
        value={selected}
        onChange={(event) => setRegister(event.target.value)}
        className={fieldClass}
      >
        {state.registers.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <input
        aria-label="Имя измерения"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Номенклатура"
        className={fieldClass}
      />
      <select
        aria-label="Справочник измерения"
        value={catalog}
        onChange={(event) => setCatalog(event.target.value)}
        className={fieldClass}
      >
        {state.catalogs.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <button
        type="submit"
        className={cmdClass}
        disabled={selected === '' || name.trim() === '' || catalog === ''}
      >
        Добавить измерение
      </button>
    </form>
  );
};

const MovementForm = ({
  state,
  lit,
  attr,
  onCommand,
}: {
  state: DesignerState;
  lit: string;
  attr: { 'data-onec-focus'?: string };
  onCommand: (command: DesignerCommand) => void;
}) => {
  const [documentName, setDocumentName] = useState(state.documents[0]?.name ?? '');
  const [register, setRegister] = useState(state.registers[0]?.name ?? '');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qtyField, setQtyField] = useState('');
  const [maps, setMaps] = useState<Record<string, string>>({});
  const document = state.documents.find((item) => item.name === documentName) ?? state.documents[0];
  const registerMeta = state.registers.find((item) => item.name === register) ?? state.registers[0];
  const numbers = document?.fields.filter((field) => field.type === 'number') ?? [];

  return (
    <form
      className={cx('space-y-2 border border-[#e4e4e4] p-2', lit)}
      {...attr}
      onSubmit={(event) => {
        event.preventDefault();
        if (!document || !registerMeta) return;
        onCommand({
          op: 'add-movement',
          document: document.name,
          register: registerMeta.name,
          direction,
          qtyField,
          dimensions: registerMeta.dimensions.map((dimension) => ({
            dimension: dimension.name,
            field: maps[dimension.name] ?? '',
          })),
        });
      }}
    >
      <p className="font-semibold">Движение</p>
      <select
        aria-label="Документ движения"
        value={document?.name ?? ''}
        onChange={(event) => setDocumentName(event.target.value)}
        className={fieldClass}
      >
        {state.documents.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <select
        aria-label="Регистр движения"
        value={registerMeta?.name ?? ''}
        onChange={(event) => setRegister(event.target.value)}
        className={fieldClass}
      >
        {state.registers.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <select
        aria-label="Направление"
        value={direction}
        onChange={(event) => setDirection(event.target.value as 'in' | 'out')}
        className={fieldClass}
      >
        <option value="in">Приход</option>
        <option value="out">Расход</option>
      </select>
      <select
        aria-label="Поле количества"
        value={qtyField}
        onChange={(event) => setQtyField(event.target.value)}
        className={fieldClass}
      >
        <option value="">Количество из</option>
        {numbers.map((field) => (
          <option key={field.name}>{field.name}</option>
        ))}
      </select>
      {registerMeta?.dimensions.map((dimension) => (
        <select
          key={dimension.name}
          aria-label={`Поле для ${dimension.name}`}
          value={maps[dimension.name] ?? ''}
          onChange={(event) =>
            setMaps((current) => ({ ...current, [dimension.name]: event.target.value }))
          }
          className={fieldClass}
        >
          <option value="">{dimension.name}</option>
          {(document?.fields ?? [])
            .filter((field) => field.type === 'ref' && field.ref === dimension.catalog)
            .map((field) => (
              <option key={field.name}>{field.name}</option>
            ))}
        </select>
      ))}
      <button
        type="submit"
        className={cmdClass}
        disabled={!document || !registerMeta || qtyField === ''}
      >
        Добавить движение
      </button>
    </form>
  );
};

const GuardForm = ({
  state,
  lit,
  attr,
  onCommand,
}: {
  state: DesignerState;
  lit: string;
  attr: { 'data-onec-focus'?: string };
  onCommand: (command: DesignerCommand) => void;
}) => {
  const [documentName, setDocumentName] = useState(state.documents[0]?.name ?? '');
  const [kind, setKind] = useState<DesignerGuard['kind']>('probe-count');
  const [standardField, setStandardField] = useState('');
  const [countField, setCountField] = useState('');
  const [ruleStandard, setRuleStandard] = useState('');
  const [ruleCount, setRuleCount] = useState('3');
  const [ruleStandard2, setRuleStandard2] = useState('');
  const [ruleCount2, setRuleCount2] = useState('7');
  const [linkField, setLinkField] = useState('');
  const [other, setOther] = useState('');
  const [keyField, setKeyField] = useState('');
  const [statusField, setStatusField] = useState('');
  const [statusValue, setStatusValue] = useState('качество подтверждено');
  const [timeField, setTimeField] = useState('');
  const [nowField, setNowField] = useState('');
  const [minutes, setMinutes] = useState('180');
  const [message, setMessage] = useState('Условие проведения не выполнено');
  const document = state.documents.find((item) => item.name === documentName) ?? state.documents[0];
  const linked = state.documents.find((item) => item.name === other);

  return (
    <form
      className={cx('space-y-2 border border-[#e4e4e4] p-2', lit)}
      {...attr}
      onSubmit={(event) => {
        event.preventDefault();
        if (!document) return;
        const text = message.trim();
        if (kind === 'probe-count') {
          onCommand({
            op: 'add-guard',
            document: document.name,
            guard: {
              kind,
              standardField,
              countField,
              rules: [
                { standard: ruleStandard.trim(), count: Number(ruleCount) },
                { standard: ruleStandard2.trim(), count: Number(ruleCount2) },
              ].filter(
                (rule) => rule.standard !== '' && Number.isInteger(rule.count) && rule.count > 0,
              ),
              message: text,
            },
          });
          return;
        }
        if (kind === 'linked-status') {
          onCommand({
            op: 'add-guard',
            document: document.name,
            guard: {
              kind,
              linkField,
              document: other,
              keyField,
              statusField,
              value: statusValue.trim(),
              message: text,
            },
          });
          return;
        }
        if (kind === 'equals') return;
        onCommand({
          op: 'add-guard',
          document: document.name,
          guard: {
            kind,
            linkField,
            document: other,
            keyField,
            timeField,
            nowField,
            minutes: Number(minutes),
            message: text,
          },
        });
      }}
    >
      <p className="font-semibold">Условие проведения</p>
      <select
        aria-label="Документ условия"
        value={document?.name ?? ''}
        onChange={(event) => setDocumentName(event.target.value)}
        className={fieldClass}
      >
        {state.documents.map((item) => (
          <option key={item.name}>{item.name}</option>
        ))}
      </select>
      <select
        aria-label="Вид условия"
        value={kind}
        onChange={(event) => setKind(event.target.value as DesignerGuard['kind'])}
        className={fieldClass}
      >
        <option value="probe-count">Число проб по стандарту</option>
        <option value="linked-status">Статус связанного документа</option>
        <option value="linked-min-minutes">Не раньше, минут</option>
        <option value="linked-max-minutes">Не позже, минут</option>
      </select>
      {kind === 'probe-count' ? (
        <>
          <FieldSelect
            label="Поле стандарта"
            fields={document?.fields.filter((field) => field.type === 'enum') ?? []}
            value={standardField}
            onChange={setStandardField}
          />
          <FieldSelect
            label="Поле числа проб"
            fields={document?.fields.filter((field) => field.type === 'number') ?? []}
            value={countField}
            onChange={setCountField}
          />
          <input
            aria-label="Первый стандарт"
            value={ruleStandard}
            onChange={(event) => setRuleStandard(event.target.value)}
            placeholder="РФ"
            className={fieldClass}
          />
          <input
            aria-label="Число проб для первого стандарта"
            value={ruleCount}
            onChange={(event) => setRuleCount(event.target.value)}
            className={fieldClass}
          />
          <input
            aria-label="Второй стандарт"
            value={ruleStandard2}
            onChange={(event) => setRuleStandard2(event.target.value)}
            placeholder="GMP"
            className={fieldClass}
          />
          <input
            aria-label="Число проб для второго стандарта"
            value={ruleCount2}
            onChange={(event) => setRuleCount2(event.target.value)}
            className={fieldClass}
          />
        </>
      ) : (
        <>
          <FieldSelect
            label="Поле связи"
            fields={
              document?.fields.filter(
                (field) => field.type === 'string' || field.type === 'enum' || field.type === 'ref',
              ) ?? []
            }
            value={linkField}
            onChange={setLinkField}
          />
          <select
            aria-label="Связанный документ"
            value={other}
            onChange={(event) => setOther(event.target.value)}
            className={fieldClass}
          >
            <option value="">Документ</option>
            {state.documents
              .filter((item) => item.name !== document?.name)
              .map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
          </select>
          <FieldSelect
            label="Ключ связанного документа"
            fields={linked?.fields ?? []}
            value={keyField}
            onChange={setKeyField}
          />
          {kind === 'linked-status' ? (
            <>
              <FieldSelect
                label="Поле статуса"
                fields={
                  linked?.fields.filter(
                    (field) => field.type === 'enum' || field.type === 'string',
                  ) ?? []
                }
                value={statusField}
                onChange={setStatusField}
              />
              <input
                aria-label="Нужный статус"
                value={statusValue}
                onChange={(event) => setStatusValue(event.target.value)}
                className={fieldClass}
              />
            </>
          ) : (
            <>
              <FieldSelect
                label="Дата связанного документа"
                fields={linked?.fields.filter((field) => field.type === 'datetime') ?? []}
                value={timeField}
                onChange={setTimeField}
              />
              <FieldSelect
                label="Дата этого документа"
                fields={document?.fields.filter((field) => field.type === 'datetime') ?? []}
                value={nowField}
                onChange={setNowField}
              />
              <input
                aria-label="Минуты"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className={fieldClass}
              />
            </>
          )}
        </>
      )}
      <input
        aria-label="Текст отказа"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className={fieldClass}
      />
      <button type="submit" className={cmdClass} disabled={!document}>
        Добавить условие
      </button>
    </form>
  );
};

const FieldSelect = ({
  label,
  fields,
  value,
  onChange,
}: {
  label: string;
  fields: DesignerField[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={fieldClass}
  >
    <option value="">{label}</option>
    {fields.map((field) => (
      <option key={field.name}>{field.name}</option>
    ))}
  </select>
);

const EnterprisePane = ({
  state,
  onBatch,
  lit,
  attr,
}: {
  state: DesignerState;
  onBatch: (commands: DesignerCommand[]) => void;
  lit: (id: Spot) => string;
  attr: (id: Spot) => { 'data-onec-focus'?: string };
}) => {
  const draft = state.ui.draft;
  const list = state.ui.list;
  if (draft) {
    return <ObjectForm state={state} onBatch={onBatch} lit={lit} attr={attr} />;
  }
  const catalogs = state.catalogs;
  const documents = state.documents;
  return (
    <div className={cx('p-3', lit('object-list'))} {...attr('object-list')}>
      {!list ? (
        <div className="grid gap-3 md:grid-cols-2">
          <HomeGroup
            title="Справочники"
            names={catalogs.map((item) => item.name)}
            onOpen={(name) => onBatch([{ op: 'open-object', name }])}
          />
          <HomeGroup
            title="Документы"
            names={documents.map((item) => item.name)}
            onOpen={(name) => onBatch([{ op: 'open-object', name }])}
          />
        </div>
      ) : (
        <ObjectList state={state} name={list} onBatch={onBatch} />
      )}
    </div>
  );
};

const HomeGroup = ({
  title,
  names,
  onOpen,
}: {
  title: string;
  names: string[];
  onOpen: (name: string) => void;
}) => (
  <section className="border border-[#e0e0e0] bg-white">
    <h3 className="border-b border-[#eee] px-3 py-2 font-semibold text-[#c65c12]">{title}</h3>
    {names.map((name) => (
      <button
        key={name}
        type="button"
        onClick={() => onOpen(name)}
        className="block min-h-11 w-full border-b border-[#f2f2f2] px-3 text-left last:border-0 hover:bg-[#fff8dc] md:min-h-9"
      >
        {name}
      </button>
    ))}
  </section>
);

const ObjectList = ({
  state,
  name,
  onBatch,
}: {
  state: DesignerState;
  name: string;
  onBatch: (commands: DesignerCommand[]) => void;
}) => {
  const items = state.items.filter((item) => item.catalog === name);
  const docs = state.docs.filter((doc) => doc.document === name);
  const isDoc = state.documents.some((document) => document.name === name);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{name}</h2>
        <button
          type="button"
          className={cmdPrimary}
          onClick={() => onBatch([{ op: 'open-new', object: name }])}
        >
          Создать
        </button>
        <button
          type="button"
          className={cmdClass}
          onClick={() => onBatch([{ op: 'open-mode', mode: 'enterprise' }])}
        >
          Назад
        </button>
      </div>
      <table className="w-full border-collapse text-left">
        <thead className="bg-[#f7f7f7]">
          <tr>
            <th className="px-2 py-1 font-medium">{isDoc ? 'Номер' : 'Наименование'}</th>
            {isDoc ? <th className="px-2 py-1 font-medium">Проведён</th> : null}
          </tr>
        </thead>
        <tbody>
          {isDoc
            ? docs.map((doc) => (
                <tr key={doc.id} className="border-t border-[#eee]">
                  <td className="px-2 py-1">{doc.number}</td>
                  <td className="px-2 py-1">{doc.posted ? 'да' : 'нет'}</td>
                </tr>
              ))
            : items.map((item) => (
                <tr key={item.id} className="border-t border-[#eee]">
                  <td className="px-2 py-1">{item.name}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
};

const ObjectForm = ({
  state,
  onBatch,
  lit,
  attr,
}: {
  state: DesignerState;
  onBatch: (commands: DesignerCommand[]) => void;
  lit: (id: Spot) => string;
  attr: (id: Spot) => { 'data-onec-focus'?: string };
}) => {
  const draft = state.ui.draft;
  const fields = useMemo(() => {
    if (!draft) return [];
    const catalog = state.catalogs.find((item) => item.name === draft.object);
    const document = state.documents.find((item) => item.name === draft.object);
    return catalog?.fields ?? document?.fields ?? [];
  }, [draft, state.catalogs, state.documents]);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!draft) return;
    const next: Record<string, string> = {};
    if (draft.kind === 'item') next['Наименование'] = draft.name;
    for (const field of fields) {
      const value = draft.values[field.name];
      next[field.name] = value === undefined ? '' : String(value);
    }
    setForm(next);
  }, [draft, fields]);

  if (!draft) return null;

  const submit = (op: 'save' | 'post'): void => {
    const batch: DesignerCommand[] = [];
    for (const [field, raw] of Object.entries(form)) {
      const meta = fields.find((item) => item.name === field);
      if (meta?.type === 'number') {
        const qty = Number(raw);
        if (!Number.isFinite(qty)) return;
        batch.push({ op: 'set-value', field, value: qty });
      } else if (raw.trim() !== '') {
        batch.push({ op: 'set-value', field, value: raw.trim() });
      }
    }
    batch.push({ op });
    onBatch(batch);
  };

  return (
    <form
      className={cx('space-y-2 p-3', lit('doc-form'))}
      {...attr('doc-form')}
      onSubmit={(event) => {
        event.preventDefault();
        submit(draft.kind === 'doc' ? 'post' : 'save');
      }}
    >
      <h2 className="font-semibold">
        {draft.object}
        {draft.number ? ` ${draft.number}` : ''}
      </h2>
      {draft.kind === 'item' ? (
        <label className="block" htmlFor="plant-item-name">
          <span>Наименование</span>
          <input
            id="plant-item-name"
            aria-label="Наименование"
            value={form['Наименование'] ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, Наименование: event.target.value }))
            }
            className={cx(fieldClass, 'mt-1')}
          />
        </label>
      ) : null}
      {fields.map((field) => (
        <div key={field.name} className="block">
          <span className="block">{field.name}</span>
          <FieldInput
            id={`plant-field-${field.name}`}
            field={field}
            state={state}
            value={form[field.name] ?? ''}
            onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {draft.kind === 'doc' ? (
          <button
            type="button"
            className={cx(cmdPrimary, lit('post'))}
            {...attr('post')}
            onClick={() => submit('post')}
          >
            Провести
          </button>
        ) : (
          <button type="submit" className={cx(cmdPrimary, lit('post'))} {...attr('post')}>
            Записать
          </button>
        )}
        {draft.kind === 'doc' ? (
          <button type="button" className={cmdClass} onClick={() => submit('save')}>
            Записать
          </button>
        ) : null}
        <button type="button" className={cmdClass} onClick={() => onBatch([{ op: 'close' }])}>
          Закрыть
        </button>
      </div>
    </form>
  );
};

const FieldInput = ({
  id,
  field,
  state,
  value,
  onChange,
}: {
  id: string;
  field: DesignerField;
  state: DesignerState;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (field.type === 'enum') {
    return (
      <select
        id={id}
        aria-label={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(fieldClass, 'mt-1')}
      >
        <option value="">Выберите</option>
        {(field.enumValues ?? []).map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'ref' && field.ref) {
    const items = state.items.filter((item) => item.catalog === field.ref);
    return (
      <select
        id={id}
        aria-label={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(fieldClass, 'mt-1')}
      >
        <option value="">Выберите</option>
        {items.map((item) => (
          <option key={item.id}>{item.name}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'datetime') {
    return (
      <input
        id={id}
        aria-label={field.name}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(fieldClass, 'mt-1')}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <input
        id={id}
        aria-label={field.name}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(fieldClass, 'mt-1')}
      />
    );
  }
  return (
    <input
      id={id}
      aria-label={field.name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cx(fieldClass, 'mt-1')}
    />
  );
};

const ReportPane = ({
  state,
  lit,
  attr,
}: {
  state: DesignerState;
  lit: (id: Spot) => string;
  attr: (id: Spot) => { 'data-onec-focus'?: string };
}) => {
  const rows = designerBalances(state);
  return (
    <div className={cx('p-3', lit('object-list'))} {...attr('object-list')}>
      <h2 className="mb-2 font-semibold">Остатки</h2>
      <table className="w-full border-collapse text-left">
        <thead className="bg-[#f7f7f7]">
          <tr>
            <th className="px-2 py-1 font-medium">Регистр</th>
            <th className="px-2 py-1 font-medium">Измерения</th>
            <th className="px-2 py-1 font-medium">Количество</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-2 text-[#777]" colSpan={3}>
                Проведённых движений нет.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={`${row.register}:${row.dims.map((dim) => dim.value).join('|')}`}
                className="border-t border-[#eee]"
              >
                <td className="px-2 py-1">{row.register}</td>
                <td className="px-2 py-1">
                  {row.dims.map((dim) => `${dim.name}: ${dim.value}`).join(', ')}
                </td>
                <td className="px-2 py-1">{formatQty(row.qty)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
