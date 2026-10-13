import { describe, expect, it } from 'vitest';

import type { DesignerCommand, DesignerSeed } from '@dotlearn/contracts';

import { DesignerCommandError } from './errors';
import { gradeDesignerSession } from './grade';
import {
  applyDesignerCommand,
  createDesignerState,
  designerBalances,
  replayDesigner,
} from './state';

const day = '2024-06-03';

const enumField = (name: string, values: string[]) => ({
  name,
  type: 'enum' as const,
  enumValues: values,
});

const refField = (name: string, catalog: string) => ({
  name,
  type: 'ref' as const,
  ref: catalog,
});

const numberField = (name: string) => ({ name, type: 'number' as const });
const stringField = (name: string) => ({ name, type: 'string' as const });
const timeField = (name: string) => ({ name, type: 'datetime' as const });

const catalogs = [
  { name: 'Номенклатура', fields: [enumField('Вид', ['Сырьё', 'Тара', 'Препарат'])] },
  { name: 'Склады', fields: [] },
  { name: 'Линии', fields: [enumField('Цех', ['Тара', 'Препарат'])] },
];

const items = [
  { catalog: 'Номенклатура', name: 'Полимер', values: { Вид: 'Сырьё' } },
  { catalog: 'Номенклатура', name: 'Картридж', values: { Вид: 'Тара' } },
  { catalog: 'Номенклатура', name: 'Инсулин', values: { Вид: 'Препарат' } },
  { catalog: 'Склады', name: 'Склад сырья', values: {} },
  { catalog: 'Склады', name: 'Склад тары', values: {} },
  { catalog: 'Склады', name: 'Склад ГП', values: {} },
  { catalog: 'Линии', name: 'Линия тары', values: { Цех: 'Тара' } },
  { catalog: 'Линии', name: 'Линия препарата', values: { Цех: 'Препарат' } },
];

const dims = (pairs: [string, string][]) =>
  pairs.map(([dimension, field]) => ({ dimension, field }));

const receiptDoc = {
  name: 'ПоступлениеСырья',
  fields: [
    refField('Номенклатура', 'Номенклатура'),
    refField('Склад', 'Склады'),
    numberField('Количество'),
  ],
  movements: [
    {
      register: 'Остатки',
      direction: 'in' as const,
      qtyField: 'Количество',
      dimensions: dims([
        ['Номенклатура', 'Номенклатура'],
        ['Склад', 'Склад'],
      ]),
    },
  ],
  guards: [],
};

const taraDoc = {
  name: 'ЗаданиеНаТару',
  fields: [
    refField('ВидТары', 'Номенклатура'),
    stringField('НомерПартии'),
    numberField('Объём'),
    timeField('Выпущена'),
    refField('СкладТары', 'Склады'),
    refField('Сырьё', 'Номенклатура'),
    refField('СкладСырья', 'Склады'),
    refField('Линия', 'Линии'),
    enumField('Стандарт', ['РФ', 'GMP']),
  ],
  movements: [
    {
      register: 'Остатки',
      direction: 'in' as const,
      qtyField: 'Объём',
      dimensions: dims([
        ['Номенклатура', 'ВидТары'],
        ['Склад', 'СкладТары'],
      ]),
    },
    {
      register: 'Остатки',
      direction: 'out' as const,
      qtyField: 'Объём',
      dimensions: dims([
        ['Номенклатура', 'Сырьё'],
        ['Склад', 'СкладСырья'],
      ]),
    },
  ],
  guards: [],
};

const drugDoc = {
  name: 'ЗаданиеНаПрепарат',
  fields: [
    refField('Препарат', 'Номенклатура'),
    refField('Сырьё', 'Номенклатура'),
    refField('СкладСырья', 'Склады'),
    stringField('НомерПартии'),
    enumField('Стандарт', ['РФ', 'GMP']),
    numberField('Объём'),
    refField('Линия', 'Линии'),
    timeField('Начато'),
  ],
  movements: [
    {
      register: 'Остатки',
      direction: 'out' as const,
      qtyField: 'Объём',
      dimensions: dims([
        ['Номенклатура', 'Сырьё'],
        ['Склад', 'СкладСырья'],
      ]),
    },
  ],
  guards: [],
};

const qcDoc = {
  name: 'КонтрольКачества',
  fields: [
    stringField('НомерПартии'),
    enumField('Стандарт', ['РФ', 'GMP']),
    numberField('ЧислоПроб'),
    enumField('Статус', ['исследования', 'качество подтверждено', 'необходим дозабор', 'брак']),
  ],
  movements: [],
  guards: [
    {
      kind: 'probe-count' as const,
      standardField: 'Стандарт',
      countField: 'ЧислоПроб',
      rules: [
        { standard: 'РФ', count: 3 },
        { standard: 'GMP', count: 7 },
      ],
      message: 'Число проб не совпало со стандартом',
    },
  ],
};

const fillDoc = {
  name: 'Розлив',
  fields: [
    stringField('НомерПартии'),
    stringField('НомерПартииТары'),
    refField('Препарат', 'Номенклатура'),
    refField('Тара', 'Номенклатура'),
    refField('СкладТары', 'Склады'),
    refField('СкладГП', 'Склады'),
    numberField('Количество'),
    timeField('Момент'),
  ],
  movements: [
    {
      register: 'Остатки',
      direction: 'out' as const,
      qtyField: 'Количество',
      dimensions: dims([
        ['Номенклатура', 'Тара'],
        ['Склад', 'СкладТары'],
      ]),
    },
    {
      register: 'Остатки',
      direction: 'in' as const,
      qtyField: 'Количество',
      dimensions: dims([
        ['Номенклатура', 'Препарат'],
        ['Склад', 'СкладГП'],
      ]),
    },
  ],
  guards: [
    {
      kind: 'linked-status' as const,
      linkField: 'НомерПартии',
      document: 'КонтрольКачества',
      keyField: 'НомерПартии',
      statusField: 'Статус',
      value: 'качество подтверждено',
      message: 'Розлив только после подтверждения качества',
    },
    {
      kind: 'linked-min-minutes' as const,
      linkField: 'НомерПартииТары',
      document: 'ЗаданиеНаТару',
      keyField: 'НомерПартии',
      timeField: 'Выпущена',
      nowField: 'Момент',
      minutes: 180,
      message: 'Тара ещё не отлежалась',
    },
    {
      kind: 'linked-max-minutes' as const,
      linkField: 'НомерПартии',
      document: 'ЗаданиеНаПрепарат',
      keyField: 'НомерПартии',
      timeField: 'Начато',
      nowField: 'Момент',
      minutes: 360,
      message: 'Препарат окислился, нужен аварийный слив',
    },
  ],
};

const drainDoc = {
  name: 'АварийныйСлив',
  fields: [stringField('НомерПартии'), refField('Препарат', 'Номенклатура'), timeField('Момент')],
  movements: [],
  guards: [
    {
      kind: 'linked-min-minutes' as const,
      linkField: 'НомерПартии',
      document: 'ЗаданиеНаПрепарат',
      keyField: 'НомерПартии',
      timeField: 'Начато',
      nowField: 'Момент',
      minutes: 360,
      message: 'До окисления слив не нужен',
    },
  ],
};

const stocked = (): DesignerSeed => ({
  today: day,
  catalogs,
  registers: [
    {
      name: 'Остатки',
      dimensions: [
        { name: 'Номенклатура', catalog: 'Номенклатура' },
        { name: 'Склад', catalog: 'Склады' },
      ],
    },
  ],
  documents: [receiptDoc, taraDoc, drugDoc, qcDoc, fillDoc, drainDoc],
  items,
  docs: [
    {
      document: 'ПоступлениеСырья',
      posted: true,
      values: { Номенклатура: 'Полимер', Склад: 'Склад сырья', Количество: 500 },
    },
  ],
});

const openDoc = (object: string, values: Record<string, string | number>): DesignerCommand[] => [
  { op: 'open-new', object },
  ...Object.entries(values).map(
    ([field, value]): DesignerCommand => ({ op: 'set-value', field, value }),
  ),
  { op: 'post' },
];

const tara = (party: string, qty: number, at: string): DesignerCommand[] =>
  openDoc('ЗаданиеНаТару', {
    ВидТары: 'Картридж',
    НомерПартии: party,
    Объём: qty,
    Выпущена: at,
    СкладТары: 'Склад тары',
    Сырьё: 'Полимер',
    СкладСырья: 'Склад сырья',
    Линия: 'Линия тары',
    Стандарт: 'РФ',
  });

const drug = (party: string, qty: number, at: string, standard: string): DesignerCommand[] =>
  openDoc('ЗаданиеНаПрепарат', {
    Препарат: 'Инсулин',
    Сырьё: 'Полимер',
    СкладСырья: 'Склад сырья',
    НомерПартии: party,
    Стандарт: standard,
    Объём: qty,
    Линия: 'Линия препарата',
    Начато: at,
  });

const qc = (party: string, standard: string, count: number): DesignerCommand[] =>
  openDoc('КонтрольКачества', {
    НомерПартии: party,
    Стандарт: standard,
    ЧислоПроб: count,
    Статус: 'качество подтверждено',
  });

const fill = (party: string, taraParty: string, qty: number, at: string): DesignerCommand[] =>
  openDoc('Розлив', {
    НомерПартии: party,
    НомерПартииТары: taraParty,
    Препарат: 'Инсулин',
    Тара: 'Картридж',
    СкладТары: 'Склад тары',
    СкладГП: 'Склад ГП',
    Количество: qty,
    Момент: at,
  });

const qtyOf = (
  state: ReturnType<typeof createDesignerState>,
  product: string,
  warehouse: string,
): number =>
  designerBalances(state).find(
    (line) =>
      line.dims.some((dim) => dim.value === product) &&
      line.dims.some((dim) => dim.value === warehouse),
  )?.qty ?? 0;

const rejects = (commands: DesignerCommand[]): string => {
  try {
    replayDesigner(stocked(), commands);
  } catch (error) {
    if (error instanceof DesignerCommandError) return error.message;
    throw error;
  }
  throw new Error('command was accepted');
};

describe('plant configurator', () => {
  it('builds catalogs and posts a receipt from commands', () => {
    const commands: DesignerCommand[] = [
      { op: 'add-catalog', name: 'Номенклатура' },
      {
        op: 'add-field',
        object: 'Номенклатура',
        name: 'Вид',
        type: 'enum',
        enumValues: ['Сырьё', 'Тара'],
      },
      { op: 'add-register', name: 'Остатки' },
      { op: 'add-dimension', register: 'Остатки', name: 'Номенклатура', catalog: 'Номенклатура' },
      { op: 'add-dimension', register: 'Остатки', name: 'Склад', catalog: 'Склады' },
    ];
    expect(() => replayDesigner({ today: day }, commands)).toThrow(DesignerCommandError);
    const fixed = replayDesigner({ today: day }, [
      { op: 'add-catalog', name: 'Склады' },
      ...commands.slice(0, 3),
      { op: 'add-dimension', register: 'Остатки', name: 'Номенклатура', catalog: 'Номенклатура' },
      { op: 'add-dimension', register: 'Остатки', name: 'Склад', catalog: 'Склады' },
      { op: 'open-mode', mode: 'enterprise' },
      { op: 'open-object', name: 'Номенклатура' },
      { op: 'open-new', object: 'Номенклатура' },
      { op: 'set-value', field: 'Наименование', value: 'Полимер' },
      { op: 'set-value', field: 'Вид', value: 'Сырьё' },
      { op: 'save' },
    ]);
    expect(fixed.items.map((item) => item.name)).toEqual(['Полимер']);
    expect(fixed.ui.mode).toBe('enterprise');
  });

  it('runs a confirmed batch inside the time window', () => {
    const state = replayDesigner(stocked(), [
      ...tara('T-14', 100, '2024-06-03T08:00'),
      ...drug('P-14', 80, '2024-06-03T09:00', 'РФ'),
      ...qc('P-14', 'РФ', 3),
      ...fill('P-14', 'T-14', 80, '2024-06-03T12:00'),
    ]);
    expect(qtyOf(state, 'Полимер', 'Склад сырья')).toBe(320);
    expect(qtyOf(state, 'Картридж', 'Склад тары')).toBe(20);
    expect(qtyOf(state, 'Инсулин', 'Склад ГП')).toBe(80);
  });

  it('refuses filling when the case rules fail and accepts a drain after oxidation', () => {
    const base = [
      ...tara('T-14', 100, '2024-06-03T08:00'),
      ...drug('P-14', 80, '2024-06-03T09:00', 'РФ'),
    ];
    expect(rejects([...base, ...fill('P-14', 'T-14', 80, '2024-06-03T12:00')])).toMatch(/качеств/);
    expect(
      rejects([...base, ...qc('P-14', 'РФ', 7), ...fill('P-14', 'T-14', 80, '2024-06-03T12:00')]),
    ).toMatch(/проб/);
    expect(
      rejects([...base, ...qc('P-14', 'РФ', 3), ...fill('P-14', 'T-14', 80, '2024-06-03T10:00')]),
    ).toMatch(/отлежал/);
    expect(
      rejects([...base, ...qc('P-14', 'РФ', 3), ...fill('P-14', 'T-14', 80, '2024-06-03T16:00')]),
    ).toMatch(/окисл/);
    expect(
      rejects([
        ...base,
        ...openDoc('АварийныйСлив', {
          НомерПартии: 'P-14',
          Препарат: 'Инсулин',
          Момент: '2024-06-03T12:00',
        }),
      ]),
    ).toMatch(/окисл/);

    const drained = replayDesigner(stocked(), [
      ...tara('T-22', 40, '2024-06-03T08:00'),
      ...drug('P-22', 40, '2024-06-03T08:00', 'GMP'),
      ...qc('P-22', 'GMP', 7),
      ...openDoc('АварийныйСлив', {
        НомерПартии: 'P-22',
        Препарат: 'Инсулин',
        Момент: '2024-06-03T15:00',
      }),
    ]);
    expect(qtyOf(drained, 'Полимер', 'Склад сырья')).toBe(420);
    expect(qtyOf(drained, 'Картридж', 'Склад тары')).toBe(40);
    expect(qtyOf(drained, 'Инсулин', 'Склад ГП')).toBe(0);
    expect(drained.docs.some((doc) => doc.document === 'Розлив' && doc.posted)).toBe(false);
  });

  it('stops a sale-like shortage and grades the final balances', () => {
    expect(rejects(tara('T-14', 600, '2024-06-03T08:00'))).toMatch(/Не хватает/);
    const commands = [
      { op: 'open-mode' as const, mode: 'enterprise' as const },
      ...tara('T-14', 100, '2024-06-03T08:00'),
      ...drug('P-14', 80, '2024-06-03T09:00', 'РФ'),
      ...qc('P-14', 'РФ', 3),
      ...fill('P-14', 'T-14', 80, '2024-06-03T12:00'),
    ];
    const grade = gradeDesignerSession(
      {
        mode: 'hybrid',
        seed: stocked(),
        steps: [
          {
            id: 'open-plant',
            title: 'Откройте предприятие',
            coach: 'Режим справа от конструктора.',
            focus: 'mode-enterprise',
            expect: [{ kind: 'mode', equals: 'enterprise' }],
          },
        ],
        goal: [
          {
            kind: 'balance',
            register: 'Остатки',
            dims: [
              { name: 'Номенклатура', value: 'Инсулин' },
              { name: 'Склад', value: 'Склад ГП' },
            ],
            qty: 80,
          },
          {
            kind: 'has-guard',
            document: 'Розлив',
            guard: 'linked-min-minutes',
            minutes: 180,
          },
          { kind: 'not-posted', document: 'АварийныйСлив' },
        ],
      },
      commands,
    );
    expect(grade.ok).toBe(true);
  });

  it('rejects a second object with the same name and a closed form', () => {
    const state = createDesignerState({ today: day, catalogs: [{ name: 'Склады', fields: [] }] });
    expect(() => applyDesignerCommand(state, { op: 'add-catalog', name: 'склады' })).toThrow(
      DesignerCommandError,
    );
    expect(() => applyDesignerCommand(state, { op: 'close' })).toThrow(DesignerCommandError);
    expect(() => applyDesignerCommand(state, { op: 'post' })).toThrow(DesignerCommandError);
  });
});
