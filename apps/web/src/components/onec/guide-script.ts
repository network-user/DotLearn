import type { OnecGoal, OnecStep } from '@dotlearn/contracts';

export const GUIDE_STEPS: OnecStep[] = [
  {
    id: 'open-catalogs',
    title: 'Откройте раздел «Справочники»',
    focus: 'sections',
    coach:
      'Жёлтая колонка слева - панель разделов. В центре сейчас начальная страница: плитки только открывают списки. «Справочники» держат то, что живёт долго и потом выбирается в документах.',
    expect: [{ kind: 'section', equals: 'catalogs' }],
  },
  {
    id: 'open-products',
    title: 'Откройте список «Номенклатура»',
    focus: 'catalog-nav',
    coach:
      'Узкая колонка рядом - панель функций текущего раздела. Чужие команды скрыты, пока не открыт их раздел. «Номенклатура» открывает форму списка.',
    expect: [{ kind: 'list', object: 'products' }],
  },
  {
    id: 'open-counterparties',
    title: 'Откройте «Контрагенты»',
    focus: 'catalog-nav',
    coach:
      'Та же панель, другая команда. У списка сверху командная панель, ниже таблица, внизу строка «Всего». Код элемента ставится сам.',
    expect: [{ kind: 'list', object: 'counterparties' }],
  },
  {
    id: 'create-counterparty',
    title: 'Создайте «ООО Ромашка»',
    focus: 'counterparty-create',
    coach:
      '«Создать» открывает карточку. Нужно наименование, затем жёлтая «Записать и закрыть». В документ попадёт это имя, не код.',
    expect: [{ kind: 'catalog-item', catalog: 'counterparties', name: 'ООО Ромашка' }],
  },
  {
    id: 'open-documents',
    title: 'Откройте раздел «Документы»',
    focus: 'sections',
    coach:
      'Документ фиксирует событие: кто, когда и что произошло. Поступление и реализация лежат здесь, не среди справочников.',
    expect: [{ kind: 'section', equals: 'documents' }],
  },
  {
    id: 'open-receipts',
    title: 'Откройте «Поступление товаров»',
    focus: 'document-nav',
    coach:
      'Это журнал. В строке номер, дата, контрагент и состояние. «Записан» ещё не двигает склад. «Проведен» уже записал движения.',
    expect: [{ kind: 'list', object: 'receipts' }],
  },
  {
    id: 'new-receipt',
    title: 'Создайте поступление',
    focus: 'receipt-create',
    coach:
      '«Создать» открывает форму. Номер и дата уже стоят. В шапке контрагент и склад, на закладке «Товары» строки. «Записать» оставляет черновик, «Провести» пишет приход. Сейчас проводить не нужно.',
    expect: [{ kind: 'form', equals: 'receipt' }],
  },
  {
    id: 'open-balances',
    title: 'Откройте остатки',
    focus: 'report-nav',
    coach:
      'Раздел «Отчёты», команда «Остатки товаров». Отчёт читает только проведённые документы. Пустая таблица значит, что проведения ещё не было. Его разберёт следующий урок.',
    expect: [{ kind: 'list', object: 'balances' }],
  },
];

export const GUIDE_GOAL: OnecGoal[] = [
  { kind: 'catalog-item', catalog: 'counterparties', name: 'ООО Ромашка' },
];
